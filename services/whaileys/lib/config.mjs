// Configuração só por variáveis de ambiente (nenhum segredo no código). Falha cedo quando falta o essencial.
import path from "node:path";

const list = (v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Origem https permitida (sem credenciais, sem caminho obrigatório). Usada para webhook e para baixar mídia. */
export function httpsOrigin(value) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password) throw new Error(`origem inválida: ${value}`);
  return u.origin;
}

export function loadConfig(env = process.env) {
  const apiKey = String(env.WHAILEYS_API_KEY ?? "");
  if (apiKey.length < 24) throw new Error("WHAILEYS_API_KEY ausente ou curta (mínimo 24 caracteres)");
  const dataDir = path.resolve(env.WHAILEYS_DATA_DIR || "./data");
  return {
    apiKey,
    port: Number(env.PORT || 8080),
    host: env.HOST || "0.0.0.0",
    dataDir,
    // Webhook só para estas origens (ex.: https://<projeto>.supabase.co). Nada de URL livre vinda da requisição.
    webhookOrigins: list(env.WHAILEYS_WEBHOOK_ORIGINS).map(httpsOrigin),
    // Mídia por URL só destas origens (ex.: Storage do Supabase). Evita o serviço baixar endereços internos.
    mediaOrigins: list(env.WHAILEYS_MEDIA_ORIGINS).map(httpsOrigin),
    maxBodyBytes: Number(env.WHAILEYS_MAX_BODY_BYTES || 1_000_000),
    maxMediaBytes: Number(env.WHAILEYS_MAX_MEDIA_BYTES || 16 * 1024 * 1024),
    maxInstances: Number(env.WHAILEYS_MAX_INSTANCES || 200),
    statusBatch: Number(env.WHAILEYS_STATUS_BATCH || 10),
    browserName: env.WHAILEYS_BROWSER_NAME || "AgendaFacil365",
  };
}
