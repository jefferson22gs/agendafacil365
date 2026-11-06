import { normalizePhone } from "@/features/whatsapp/contacts/phone";

export type AudienceSource = "clientes" | "whatsapp" | "arquivo" | "manual";
export interface AudienceInput { name?: string | null; phone?: string | null; source: AudienceSource }
export interface Recipient { name: string; phone: string; source: AudienceSource }
export type RejectReason = "invalid" | "duplicate" | "suppressed" | "group" | "broadcast" | "lid";
export interface Rejected { name: string; raw: string; reason: RejectReason; source: AudienceSource }
export const REJECT_LABEL: Record<RejectReason, string> = {
  invalid: "Número inválido ou sem DDD/país", duplicate: "Repetido", suppressed: "Pediu para não receber campanhas",
  group: "Grupo do WhatsApp", broadcast: "Lista de transmissão ou canal", lid: "Contato oculto sem número",
};
/** Limite por chamada da Edge Function/RPC whatsapp_create_campaign. */
export const BATCH_SIZE = 1000;
/** Ritmo do outbox: 1 mensagem a cada 3 s por instância (whatsapp_claim_outbox). */
export const SECONDS_PER_MESSAGE = 3;

/**
 * Telefone canônico E.164 ou motivo da rejeição. Celular BR antigo sem o 9º dígito (DDD + 8 dígitos iniciando em 6-9)
 * recebe o 9; fixo (2-5) fica como está. Internacional exige DDI explícito (+ ou 00). Nunca adivinha DDD.
 */
export function canonicalPhone(raw: string): { phone: string } | { reason: RejectReason } {
  const text = raw.trim();
  if (/@g\.us$/i.test(text)) return { reason: "group" };
  if (/@(broadcast|newsletter)$/i.test(text)) return { reason: "broadcast" };
  if (/@lid$/i.test(text)) return { reason: "lid" };
  if (text.includes("@") && !/^\d{7,15}@s\.whatsapp\.net$/i.test(text)) return { reason: "invalid" };
  let candidate = text.includes("@") ? `+${text.split("@")[0]}` : text;
  const digits = candidate.replace(/\D/g, "");
  const international = /^\s*(\+|00)/.test(candidate) || text.includes("@");
  const national = international ? (digits.replace(/^00/, "").startsWith("55") ? digits.replace(/^00/, "").slice(2) : null)
    : digits.length === 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national !== null && national.length === 10 && /^[1-9]{2}[6-9]/.test(national)) candidate = `+55${national.slice(0, 2)}9${national.slice(2)}`;
  const phone = normalizePhone(candidate, "BR");
  return phone ? { phone } : { reason: "invalid" };
}

/** Normaliza, remove duplicados (primeira ocorrência vence) e respeita opt-out de marketing. */
export function buildAudience(inputs: AudienceInput[], suppressed: Iterable<string> = []): { recipients: Recipient[]; rejected: Rejected[] } {
  const blocked = new Set(suppressed), seen = new Set<string>();
  const recipients: Recipient[] = [], rejected: Rejected[] = [];
  for (const input of inputs) {
    const raw = String(input.phone ?? ""), name = String(input.name ?? "").replace(/[\r\n{}]/g, " ").trim().slice(0, 120);
    const result = canonicalPhone(raw);
    const reason: RejectReason | null = "reason" in result ? result.reason : blocked.has(result.phone) ? "suppressed" : seen.has(result.phone) ? "duplicate" : null;
    if (reason) { rejected.push({ name, raw, reason, source: input.source }); continue; }
    const phone = (result as { phone: string }).phone;
    seen.add(phone);
    recipients.push({ name, phone, source: input.source });
  }
  return { recipients, rejected };
}

/** Mesmo contrato de campaignText no servidor: só {nome}/{{nome}} como variável. */
export function templateError(message: string): string | null {
  if (!message.trim()) return "Escreva a mensagem.";
  if (message.length > 4096) return "A mensagem passa de 4.096 caracteres.";
  if (/\{\{(?!nome\}\})/.test(message)) return "Use somente a variável {nome}.";
  return null;
}
export function previewText(message: string, name: string): string {
  const first = name.replace(/[\r\n{}]/g, " ").trim().split(/\s+/)[0] || "";
  return message.replace(/\{\{nome\}\}|\{nome\}/gi, first).replace(/Olá\s*,\s*!/gi, "Olá!").trim();
}

/** Lotes de até 1.000 com chave de idempotência estável: repetir um lote após falha de rede não duplica envios. */
export function campaignBatches(recipients: Recipient[], ids: string[] = [], newId: () => string = () => crypto.randomUUID()) {
  const batches: { submissionId: string; recipients: { phone: string; name: string }[] }[] = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    batches.push({ submissionId: ids[batches.length] ?? newId(), recipients: recipients.slice(i, i + BATCH_SIZE).map(({ phone, name }) => ({ phone, name })) });
  }
  return batches;
}
export const estimatedMinutes = (count: number) => Math.ceil((count * SECONDS_PER_MESSAGE) / 60);
