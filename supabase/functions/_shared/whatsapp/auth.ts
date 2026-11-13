import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WhatsAppError } from "./errors.ts";

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new WhatsAppError("configuration_missing", 503);
  return value;
}
export function serviceClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}
function bearer(req: Request): string {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new WhatsAppError("unauthorized", 401);
  return token;
}
export function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export async function authorizeSalon(req: Request, db: SupabaseClient, salonId: unknown): Promise<string> {
  if (!validUuid(salonId)) throw new WhatsAppError("invalid_request");
  const { data, error } = await db.auth.getUser(bearer(req));
  if (error || !data.user) throw new WhatsAppError("unauthorized", 401);
  const userId = data.user.id;
  const { data: salon, error: salonError } = await db.from("salons").select("id,owner_id").eq("id", salonId).maybeSingle();
  if (salonError) throw new WhatsAppError("persistence_failed", 503);
  if (salon?.owner_id === userId) return userId;
  if (!salon) throw new WhatsAppError("forbidden", 403);
  const { data: roles, error: roleError } = await db.from("user_roles").select("id").eq("user_id", userId).eq("salon_id", salonId).eq("role", "admin").limit(1);
  if (roleError) throw new WhatsAppError("persistence_failed", 503);
  if (!roles?.length) throw new WhatsAppError("forbidden", 403);
  return userId;
}
// Projeto migrou para chaves sb_secret_* mas o cron (Vault) ainda envia a service role JWT legada.
// Aceita qualquer chave secreta do próprio projeto; nunca decodifica claims sem verificar.
function workerKeys(): string[] {
  const keys = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), Deno.env.get("WORKER_LEGACY_SERVICE_ROLE_KEY")];
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (parsed && typeof parsed === "object") keys.push(...Object.values(parsed).map(String));
  } catch { /* formato inesperado: ignora */ }
  return keys.filter((k): k is string => typeof k === "string" && k.length >= 32);
}
/** Workers não aceitam JWT de cliente nem confiam em um claim role não verificado. */
export function authorizeWorker(req: Request): void {
  const token = bearer(req);
  const keys = workerKeys();
  if (!keys.length) throw new WhatsAppError("configuration_missing", 503);
  let ok = false;
  for (const key of keys) ok = safeEqual(token, key) || ok;
  if (!ok) throw new WhatsAppError("forbidden", 403);
}
export function safeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
/** evolution = QR Code; whaileys = QR Code com botões (mesmo contrato HTTP); meta = API oficial. */
export type WhatsAppProvider = "evolution" | "meta" | "whaileys";
export interface SalonInstance { id: string; salon_id: string; instance_name: string; status: string; phone_number: string | null; provider: WhatsAppProvider }
/**
 * Conexão do salão para a finalidade (o salão pode ter oficial + QR Code + QR Code com botões):
 * chat = a escolhida para o robô; marketing/status = QR Code; evolution/whaileys = aquela conexão (tela Conexão).
 */
export type InstancePurpose = "chat" | "marketing" | "status" | "evolution" | "whaileys";
export async function salonInstance(db: SupabaseClient, salonId: string, purpose: InstancePurpose = "chat"): Promise<SalonInstance> {
  const cols = "id,salon_id,instance_name,status,phone_number,provider";
  let query;
  if (purpose === "evolution" || purpose === "whaileys") query = db.from("whatsapp_instances").select(cols).eq("salon_id", salonId).eq("provider", purpose).maybeSingle();
  else {
    const { data: id, error: pickError } = await db.rpc("whatsapp_instance_for", { p_salon_id: salonId, p_purpose: purpose });
    if (pickError) throw new WhatsAppError("persistence_failed", 503);
    if (!id) throw new WhatsAppError("instance_missing", 409);
    query = db.from("whatsapp_instances").select(cols).eq("id", id).maybeSingle();
  }
  const { data, error } = await query;
  if (error) throw new WhatsAppError("persistence_failed", 503);
  if (!data) throw new WhatsAppError("instance_missing", 409);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(data.instance_name)) throw new WhatsAppError("configuration_missing", 503);
  return data;
}
