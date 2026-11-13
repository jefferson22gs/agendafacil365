import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pixBRCode } from "./brcode.ts";
import { WhatsAppError } from "../whatsapp/errors.ts";
import { evolutionClient, type EvolutionOperation } from "../whatsapp/evolution.ts";
import { metaClient } from "../whatsapp/meta.ts";

export interface PixContext {
  db: SupabaseClient;
  salonId: string;
  phone: string;
  eventId?: string;
  preview?: boolean;
}
export interface PixMedia { path: string; mime: string; filename: string; caption: string }
export interface PixResult { key: string; payload: string; media: PixMedia }
export type ProofResult =
  | { ok: true; proofId: string | null }
  | { ok: false; reason: "not_found" | "invalid_media" | "too_large" | "download_failed" | "appointment" };

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** MIME real pelos magic bytes; ignora o mimetype declarado pelo remetente. */
export function detectProofMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

/** Decodifica base64 (aceita data URL) recusando acima do limite antes de alocar. */
export function decodeProof(base64: unknown): { bytes: Uint8Array } | { error: "invalid_media" | "too_large" } {
  if (typeof base64 !== "string") return { error: "invalid_media" };
  const clean = base64.replace(/^data:[^,]{0,100},/, "").replace(/\s/g, "");
  if (!clean || clean.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(clean)) return { error: "invalid_media" };
  if (clean.length > Math.ceil(PROOF_MAX_BYTES / 3) * 4) return { error: "too_large" };
  let bin: string;
  try { bin = atob(clean); } catch { return { error: "invalid_media" }; }
  if (bin.length > PROOF_MAX_BYTES) return { error: "too_large" };
  return { bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)) };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const safeSegment = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);

/** PIX copia-e-cola + QR PNG em whatsapp-media/{salonId}/pix/. Null se salão sem chave válida ou agendamento alheio. */
export async function bookingPix(ctx: PixContext, appointmentId: string): Promise<PixResult | null> {
  const { db, salonId, phone } = ctx;
  const { data: salon, error: salonError } = await db.from("salons")
    .select("pix_key,name,city").eq("id", salonId).maybeSingle();
  if (salonError) throw new WhatsAppError("persistence_failed", 503);
  if (!salon?.pix_key) return null;

  const { data: appointment, error: appointmentError } = await db.from("appointments")
    .select("id,final_price,price,client_phone").eq("id", appointmentId).eq("salon_id", salonId).maybeSingle();
  if (appointmentError) throw new WhatsAppError("persistence_failed", 503);
  if (!appointment || appointment.client_phone !== phone) return null;

  const price = Number(appointment.final_price ?? appointment.price);
  const amount = Number.isFinite(price) && price >= 0.01 ? Math.round(price * 100) / 100 : undefined;
  let payload: string;
  try {
    payload = pixBRCode({ key: String(salon.pix_key).trim(), name: salon.name || "Salao", city: salon.city || "Brasil", amount, txid: appointmentId.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) });
  } catch { return null; } // ponytail: chave PIX mal cadastrada não derruba o atendimento; validar no cadastro do salão.

  const filename = `pix-${safeSegment(appointmentId)}.png`;
  const path = `${salonId}/pix/${filename}`;
  if (!ctx.preview) {
    const { default: QRCode } = await import("npm:qrcode@1.5.3");
    const png: Uint8Array = await QRCode.toBuffer(payload, { type: "png", errorCorrectionLevel: "M", width: 512, margin: 2 });
    const { error } = await db.storage.from("whatsapp-media").upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new WhatsAppError("persistence_failed", 503);
  }
  const caption = ["*PIX para pagamento*", amount ? `Valor: ${brl(amount)}` : null, `Chave: ${salon.pix_key}`, "",
    "Escaneie o QR Code ou use o PIX copia e cola enviado a seguir.", "Depois de pagar, envie o comprovante por aqui."]
    .filter((l) => l !== null).join("\n");
  return { key: String(salon.pix_key), payload, media: { path, mime: "image/png", filename, caption } };
}

/**
 * Salva comprovante (imagem/PDF) de evento de mídia autenticado do próprio cliente.
 * Idempotente por (salon_id, provider_message_id). Nunca altera appointments.paid.
 */
export async function receivePaymentProof(ctx: PixContext, appointmentId: string, sourceEventId = ctx.eventId): Promise<ProofResult> {
  const { db, salonId, phone } = ctx;
  if (!sourceEventId) return { ok: false, reason: "not_found" };

  const { data: event, error: eventError } = await db.from("whatsapp_webhook_events")
    .select("id,instance_id,provider_message_id,payload")
    .eq("id", sourceEventId).eq("salon_id", salonId).eq("sender_phone", phone).maybeSingle();
  if (eventError) throw new WhatsAppError("persistence_failed", 503);
  if (!event?.provider_message_id) return { ok: false, reason: "not_found" };
  const media = (event.payload as { media?: { type?: unknown } } | null)?.media;
  if (media?.type !== "image" && media?.type !== "document") return { ok: false, reason: "invalid_media" };

  const { data: appointment, error: appointmentError } = await db.from("appointments")
    .select("id,client_phone").eq("id", appointmentId).eq("salon_id", salonId).maybeSingle();
  if (appointmentError) throw new WhatsAppError("persistence_failed", 503);
  if (!appointment || appointment.client_phone !== phone) return { ok: false, reason: "appointment" };

  const messageId = String(event.provider_message_id);
  const existing = async () => {
    const { data, error } = await db.from("appointment_payment_proofs").select("id")
      .eq("salon_id", salonId).eq("provider_message_id", messageId).maybeSingle();
    if (error) throw new WhatsAppError("persistence_failed", 503);
    return data?.id as string | undefined;
  };
  const found = await existing();
  if (found) return { ok: true, proofId: found };
  if (ctx.preview) return { ok: true, proofId: null };

  const { data: instance, error: instanceError } = await db.from("whatsapp_instances")
    .select("instance_name,provider").eq("id", event.instance_id).eq("salon_id", salonId).maybeSingle();
  if (instanceError) throw new WhatsAppError("persistence_failed", 503);
  if (!instance?.instance_name) return { ok: false, reason: "download_failed" };

  let result: { base64?: unknown; fileName?: unknown } = {};
  let downloaded: Uint8Array | null = null;
  if (instance.provider === "meta") {
    // API oficial: o webhook guarda o id da mídia; o download exige o token do sistema.
    const mediaId = (event.payload as { mediaId?: unknown } | null)?.mediaId;
    const file = typeof mediaId === "string" ? await metaClient().media(mediaId) : null;
    if (!file) return { ok: false, reason: "download_failed" };
    if (file.bytes.byteLength > PROOF_MAX_BYTES) return { ok: false, reason: "too_large" };
    downloaded = file.bytes;
    result.fileName = (event.payload as { media?: { name?: unknown } } | null)?.media?.name;
  } else {
    try {
      // ponytail: op "mediaBase64" adicionada em evolution.ts pelo atendente; cast cai fora quando estiver no union.
      result = await evolutionClient(instance.provider).request("mediaBase64" as EvolutionOperation, instance.instance_name, {
        message: { key: { id: messageId, remoteJid: `${phone.slice(1)}@s.whatsapp.net`, fromMe: false } }, convertToMp4: false,
      }) as typeof result;
    } catch { return { ok: false, reason: "download_failed" }; }
  }

  const decoded = downloaded ? { bytes: downloaded } : decodeProof(result?.base64);
  if ("error" in decoded) return { ok: false, reason: decoded.error };
  const mime = detectProofMime(decoded.bytes);
  if (!mime) return { ok: false, reason: "invalid_media" };

  const rawName = typeof result.fileName === "string" && result.fileName.trim() ? result.fileName.trim() : `comprovante.${PROOF_EXT[mime]}`;
  const path = `${salonId}/payment-proofs/${safeSegment(messageId)}.${PROOF_EXT[mime]}`;
  // Caminho determinístico por mensagem: retry sobrescreve o mesmo objeto, sem órfãos.
  const { error: uploadError } = await db.storage.from("payment-proofs").upload(path, decoded.bytes, { contentType: mime, upsert: true });
  if (uploadError) throw new WhatsAppError("persistence_failed", 503);

  const { data: row, error: insertError } = await db.from("appointment_payment_proofs").insert({
    appointment_id: appointmentId, salon_id: salonId, phone, provider_message_id: messageId,
    media_path: path, media_mime: mime, media_name: rawName.slice(0, 200), status: "enviado",
  }).select("id").single();
  if (insertError?.code === "23505") {
    const raced = await existing();
    if (raced) return { ok: true, proofId: raced };
  }
  if (insertError || !row) throw new WhatsAppError("persistence_failed", 503);
  return { ok: true, proofId: row.id as string };
}
