export class WhatsAppError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
const messages: Record<string, string> = {
  unauthorized: "Entre novamente para continuar.",
  forbidden: "Você não tem permissão para este salão.",
  invalid_request: "Confira os dados informados.",
  configuration_missing: "A integração precisa ser configurada pela equipe.",
  instance_missing: "Conecte o WhatsApp do salão primeiro.",
  recipient_missing: "Cadastre e verifique um número para receber os relatórios.",
  disconnected: "Seu WhatsApp está desconectado. Reconecte para continuar.",
  provider_rejected: "O WhatsApp não aceitou esta operação.",
  provider_unavailable: "A conexão com o WhatsApp está indisponível.",
  send_uncertain: "Não foi possível confirmar o resultado do envio. Não repita sem conferir o histórico.",
  persistence_failed: "Não foi possível salvar o resultado. Confira o estado antes de repetir.",
  conversation_missing: "Esta conversa não existe neste salão.",
  provider_rate_limited: "Muitas mensagens em pouco tempo. Aguarde alguns minutos.",
  feature_removed: "A IA agora é configurada pela plataforma. Não é preciso informar chave.",
};
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
export function errorResponse(error: unknown) {
  const safe = error instanceof WhatsAppError ? error : new WhatsAppError("internal_error", 500);
  // Nenhum payload, telefone, URL, token ou stack no log/resposta.
  console.warn("whatsapp_operation_failed", safe.code);
  return jsonResponse({ success: false, code: safe.code, error: messages[safe.code] ?? "Não foi possível concluir a operação." }, safe.status);
}
export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WhatsAppError("invalid_request");
  return value as Record<string, unknown>;
}
export async function readRequest(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
  if (!req.headers.get("content-type")?.includes("application/json")) throw new WhatsAppError("invalid_request", 415);
  // Limite também vale para requests chunked, não apenas Content-Length.
  if (!req.body) throw new WhatsAppError("invalid_request");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512_000) { await reader.cancel(); throw new WhatsAppError("invalid_request", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return objectValue(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new WhatsAppError("invalid_request"); }
}
