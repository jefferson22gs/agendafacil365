// WhatsApp oficial (Meta Cloud API, Graph v21.0). Envio, leitura de webhook e validação de assinatura.
// Token e segredo só por variáveis de ambiente (META_SYSTEM_TOKEN, META_APP_SECRET). Nunca em log ou banco.
import { requiredEnv } from "./auth.ts";
import { WhatsAppError } from "./errors.ts";
import type { IncomingMessage, InboxMessage, DeliveryStatus } from "./inbound.ts";

export const GRAPH = "https://graph.facebook.com/v21.0";
/** Limites da Cloud API: botões de resposta (3 × 20), lista (10 linhas, título 24, descrição 72, botão 20, corpo 1024). */
export const META = { BUTTONS: 3, BUTTON_TITLE: 20, ROWS: 10, ROW_TITLE: 24, ROW_DESC: 72, LIST_BUTTON: 20, BODY: 1024, HEADER: 60, FOOTER: 60 } as const;

export type HttpTransport = typeof fetch;
export class MetaClient {
  constructor(private token: string, private transport: HttpTransport = fetch) {}
  /** POST /{phoneNumberId}/messages. Erro de rede/5xx = incerto (pode ter saído); 4xx = recusado (nada saiu). */
  async send(phoneNumberId: string, body: Record<string, unknown>): Promise<string> {
    if (!/^\d{5,30}$/.test(phoneNumberId)) throw new WhatsAppError("configuration_missing", 503);
    // Destinatário obrigatório: só dígitos de número individual (nunca grupo).
    if (typeof body.to !== "string" || !/^[1-9]\d{7,14}$/.test(body.to)) throw new WhatsAppError("invalid_request");
    let response: Response;
    try {
      response = await this.transport(`${GRAPH}/${phoneNumberId}/messages`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
      });
    } catch { throw new WhatsAppError("send_uncertain", 503); }
    const data = await response.json().catch(() => null) as { messages?: { id?: string }[]; error?: { code?: number } } | null;
    if (!response.ok) {
      if (response.status >= 500) throw Object.assign(new WhatsAppError("send_uncertain", 503), { http: response.status });
      const code = Number(data?.error?.code);
      // 131047/131026: fora da janela de 24h ou número sem WhatsApp. 130429/131048/131056: limite de envio.
      if ([130429, 131048, 131056, 80007].includes(code)) throw Object.assign(new WhatsAppError("provider_rate_limited", 429), { meta: code });
      throw Object.assign(new WhatsAppError("provider_rejected", 502), { meta: code });
    }
    const id = data?.messages?.[0]?.id;
    if (typeof id !== "string" || !id) throw new WhatsAppError("send_uncertain", 502);
    return id;
  }
  /** Marca como lida e mostra "digitando…" (até 25 s ou até a resposta). Best effort. */
  async typing(phoneNumberId: string, messageId: string): Promise<void> {
    try {
      await this.transport(`${GRAPH}/${phoneNumberId}/messages`, {
        method: "POST", signal: AbortSignal.timeout(8_000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
      });
    } catch { /* indicador é cosmético */ }
  }
  /** Mídia recebida (comprovante): URL temporária e download autenticado. */
  async media(mediaId: string): Promise<{ bytes: Uint8Array; mime: string | null } | null> {
    if (!/^\d{5,40}$/.test(mediaId)) return null;
    try {
      const meta = await (await this.transport(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(15_000) })).json() as { url?: string; mime_type?: string };
      if (!meta?.url || !/^https:\/\/[^/]+\.(fbcdn\.net|facebook\.com|whatsapp\.net)\//.test(meta.url)) return null;
      const r = await this.transport(meta.url, { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) return null;
      return { bytes: new Uint8Array(await r.arrayBuffer()), mime: meta.mime_type ?? null };
    } catch { return null; }
  }
}
export function metaClient(): MetaClient { return new MetaClient(requiredEnv("META_SYSTEM_TOKEN")); }

const clipChars = (s: unknown, n: number) => { const a = Array.from(String(s ?? "").replace(/\s+/g, " ").trim()); return a.length <= n ? a.join("") : a.slice(0, n - 1).join("").trimEnd() + "…"; };
const clipText = (s: unknown, n: number) => { const a = Array.from(String(s ?? "").trim()); return a.length <= n ? a.join("") : a.slice(0, n - 1).join("") + "…"; };

/**
 * Payload interno do outbox (formato Evolution: buttons/list/poll) → mensagem interativa da Cloud API.
 * Até 3 opções curtas = botões de resposta; senão lista ("☰ Menu"). Enquete vira lista (a Cloud API não usa poll aqui).
 */
export function toMetaInteractive(payload: Record<string, unknown> | null, fallbackText: string): Record<string, unknown> | null {
  const op = payload?.op, body = (payload?.body ?? {}) as Record<string, unknown>;
  type Opt = { id: string; title: string; description?: string };
  let opts: Opt[] = [];
  let text = "", footer = "", header = "", button = "Ver opções";
  if (op === "buttons") {
    opts = ((body.buttons as { id?: string; displayText?: string }[]) ?? []).filter(b => b?.id).map(b => ({ id: String(b.id), title: String(b.displayText ?? "") }));
    text = String(body.description ?? ""); footer = String(body.footer ?? ""); header = String(body.title ?? "");
  } else if (op === "list") {
    const rows = ((body.sections as { rows?: { rowId?: string; title?: string; description?: string }[] }[]) ?? []).flatMap(s => s?.rows ?? []);
    opts = rows.filter(r => r?.rowId).map(r => ({ id: String(r.rowId), title: String(r.title ?? ""), description: r.description && r.description.trim() ? String(r.description) : undefined }));
    text = String(body.description ?? ""); footer = String(body.footerText ?? ""); header = String(body.title ?? ""); button = String(body.buttonText ?? button);
  } else if (op === "poll") {
    opts = ((payload?.options as { id?: string; title?: string }[]) ?? []).filter(o => o?.id).map(o => ({ id: String(o.id), title: String(o.title ?? "").replace(/^\S*\d️⃣\s*|^🔟\s*/u, "") }));
    text = String(body.name ?? "");
  } else return null;
  if (!opts.length || opts.length > META.ROWS) return null;
  text = clipText(text.trim() || fallbackText.split("\n\n")[0] || "Escolha uma opção:", META.BODY);
  const asButtons = opts.length <= META.BUTTONS && opts.every(o => !o.description && Array.from(o.title).length <= META.BUTTON_TITLE);
  const common = { body: { text }, ...(footer.trim() ? { footer: { text: clipChars(footer, META.FOOTER) } } : {}) };
  if (asButtons) {
    return { type: "interactive", interactive: { type: "button", ...(header.trim() ? { header: { type: "text", text: clipChars(header, META.HEADER) } } : {}), ...common,
      action: { buttons: opts.map(o => ({ type: "reply", reply: { id: o.id.slice(0, 256), title: clipChars(o.title, META.BUTTON_TITLE) } })) } } };
  }
  return { type: "interactive", interactive: { type: "list", ...(header.trim() ? { header: { type: "text", text: clipChars(header, META.HEADER) } } : {}), ...common,
    action: { button: clipChars(button, META.LIST_BUTTON), sections: [{ title: clipChars(header || "Opções", META.ROW_TITLE), rows: opts.map(o => ({ id: o.id.slice(0, 200), title: clipChars(o.title, META.ROW_TITLE), ...(o.description ? { description: clipChars(o.description, META.ROW_DESC) } : {}) })) }] } } };
}

/** Assinatura do webhook: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo bruto, App Secret). Tempo constante. */
export async function validMetaSignature(raw: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  const got = header?.match(/^sha256=([0-9a-f]{64})$/i)?.[1]?.toLowerCase();
  if (!got || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, raw)), b => b.toString(16).padStart(2, "0")).join("");
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null);
const str = (v: unknown, n = 8000) => (typeof v === "string" ? v.slice(0, n) : "");
const SELECTION = /^(?:[a-z0-9]{1,12}\.[a-z0-9]{1,8}|[a-z][a-z0-9_]{2,30})$/;
const WAMID = /^wamid\.[A-Za-z0-9_=+/-]{10,200}$/;
export interface MetaChange { phoneNumberId: string; incoming: (IncomingMessage & { mediaId?: string | null; timestamp: string | null })[]; inbox: InboxMessage[]; statuses: { id: string; status: DeliveryStatus | "failed"; error?: number }[] }

/** entry[].changes[].value (field "messages") → mensagens recebidas, histórico e status de entrega. */
export function parseMetaWebhook(body: unknown): MetaChange[] {
  const out: MetaChange[] = [];
  for (const entry of (Array.isArray(rec(body)?.entry) ? rec(body)!.entry as unknown[] : []).slice(0, 50)) {
    for (const change of (Array.isArray(rec(entry)?.changes) ? rec(entry)!.changes as unknown[] : []).slice(0, 50)) {
      const c = rec(change), v = rec(c?.value);
      if (!v || (c?.field !== "messages" && c?.field !== "smb_message_echoes")) continue;
      const phoneNumberId = str(rec(v.metadata)?.phone_number_id, 40);
      if (!/^\d{5,30}$/.test(phoneNumberId)) continue;
      // Coexistência: o que o salão manda pelo app do celular volta como eco (saída "pelo celular" na Central).
      if (c.field === "smb_message_echoes") {
        const res: MetaChange = { phoneNumberId, incoming: [], inbox: [], statuses: [] };
        for (const raw of (Array.isArray(v.message_echoes) ? v.message_echoes : []).slice(0, 100) as unknown[]) {
          const m = rec(raw), to = str(m?.to, 20), id = str(m?.id, 200), ts = Number(m?.timestamp);
          if (!/^[1-9]\d{7,14}$/.test(to) || !WAMID.test(id)) continue;
          const type = str(m!.type, 30) || "text";
          res.inbox.push({ id, phone: `+${to}`, direction: "out", kind: type === "text" ? "text" : "media", type, body: str(rec(m!.text)?.body).trim(), mediaUrl: null, mediaMime: null, mediaName: null, name: null,
            createdAt: Number.isFinite(ts) && ts > 1e9 ? new Date(ts * 1000).toISOString() : null });
        }
        out.push(res);
        continue;
      }
      const names = new Map<string, string>();
      for (const ct of (Array.isArray(v.contacts) ? v.contacts : []) as unknown[]) names.set(str(rec(ct)?.wa_id, 20), str(rec(rec(ct)?.profile)?.name, 120));
      const res: MetaChange = { phoneNumberId, incoming: [], inbox: [], statuses: [] };
      for (const raw of (Array.isArray(v.messages) ? v.messages : []).slice(0, 100) as unknown[]) {
        const m = rec(raw);
        const from = str(m?.from, 20), id = str(m?.id, 200);
        if (!/^[1-9]\d{7,14}$/.test(from) || !WAMID.test(id)) continue;
        const ts = Number(m!.timestamp);
        const timestamp = Number.isFinite(ts) && ts > 1e9 ? new Date(ts * 1000).toISOString() : null;
        const base = { id, phone: `+${from}`, jid: `${from}@s.whatsapp.net`, name: names.get(from) || "Cliente", quotedMessageId: str(rec(m!.context)?.id, 200) || null, timestamp };
        const type = str(m!.type, 30);
        let text = "", selection: string | null = null, kind: InboxMessage["kind"] = "text", mtype = "text", media: IncomingMessage["media"] = null, mediaId: string | null = null;
        if (type === "text") text = str(rec(m!.text)?.body);
        else if (type === "interactive") {
          const it = rec(m!.interactive), reply = rec(it?.button_reply) ?? rec(it?.list_reply);
          const rid = str(reply?.id, 256);
          selection = SELECTION.test(rid) ? rid : null;
          text = str(reply?.title, 200); kind = "interactive"; mtype = it?.list_reply ? "list_reply" : "buttons_reply";
        } else if (type === "button") { text = str(rec(m!.button)?.text, 200); const p = str(rec(m!.button)?.payload, 256); selection = SELECTION.test(p) ? p : null; kind = "interactive"; mtype = "buttons_reply"; }
        else if (type === "image" || type === "document") {
          const md = rec(m![type]);
          mediaId = str(md?.id, 40) || null;
          text = str(md?.caption, 1000); kind = "media"; mtype = type;
          media = { type, mime: str(md?.mime_type, 100) || null, name: str(md?.filename, 200) || null, url: null };
        } else { kind = "media"; mtype = type || "unknown"; }
        res.inbox.push({ id, phone: base.phone, direction: "in", kind, type: mtype, body: (text || "").trim().slice(0, 8000), mediaUrl: null, mediaMime: media?.mime ?? null, mediaName: media?.name ?? null, name: base.name, createdAt: timestamp });
        if (text.trim() || selection || media) res.incoming.push({ ...base, text: (text || selection || "").trim(), selection, media, mediaId });
      }
      for (const raw of (Array.isArray(v.statuses) ? v.statuses : []).slice(0, 200) as unknown[]) {
        const s = rec(raw), id = str(s?.id, 200), st = str(s?.status, 20);
        if (!WAMID.test(id) || !["sent", "delivered", "read", "failed"].includes(st)) continue;
        const err = Number(rec((s!.errors as unknown[] | undefined)?.[0])?.code);
        res.statuses.push({ id, status: st as DeliveryStatus | "failed", ...(Number.isFinite(err) ? { error: err } : {}) });
      }
      out.push(res);
    }
  }
  return out;
}
