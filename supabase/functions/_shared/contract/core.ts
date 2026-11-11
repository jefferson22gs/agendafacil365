// Contrato SaaS: validação, preenchimento do modelo oficial e hash. Puro (sem Deno/IO): usado pela Edge Function
// autentique-contract (fonte da verdade) e testado em tests/rebrand/contract.test.cjs.
import { CONTRACT_TEMPLATE, CONTRACT_VERSION } from "./template.ts";

export { CONTRACT_VERSION };

/** Planos: mesmos valores cobrados no checkout (supabase/functions/_shared/infinitepay/core.ts). */
export const CONTRACT_PLANS = {
  monthly: { name: "Agenda Fácil 365 Premium", cycle: "Mensal", cents: 3990 },
  annual: { name: "Agenda Fácil 365 Premium", cycle: "Anual", cents: 40000 },
} as const;
export type ContractPlan = keyof typeof CONTRACT_PLANS;
export const PLAN_LIMITS = "Profissionais, agendamentos e clientes ilimitados; lembretes, retornos e campanhas conforme a política de uso do WhatsApp; 1 estabelecimento por licença";

export const SEGMENTS = ["Salão de Beleza", "Barbearia", "Clínica de Estética", "Odontologia", "Clínica", "Bem-Estar", "Outro"] as const;

export interface ContratanteInput {
  estabelecimento_nome: string; estabelecimento_cnpj: string; estabelecimento_segmento: string;
  endereco_logradouro: string; endereco_numero: string; endereco_bairro: string; endereco_cidade: string; endereco_uf: string; endereco_cep: string;
  responsavel_nome: string; responsavel_cpf: string; responsavel_email: string; responsavel_telefone: string;
  plan: ContractPlan;
}
export interface ContratadaInfo {
  company_name: string; cnpj: string; address: string; representative_name: string; representative_cpf?: string | null; email: string;
  platform_url: string; city: string; forum: string;
  /** Parágrafo próprio de qualificação da CONTRATADA (ex.: MEI). Aceita as mesmas variáveis {{...}}. */
  preamble?: string | null;
  /** E-mail que recebe o convite de assinatura da Autentique (padrão: email). */
  signer_email?: string | null;
}
export interface ContractContext { slug: string; trialDays: number; trialStart: Date; trialEnd: Date; now: Date }

export const digits = (v: string) => (v ?? "").replace(/\D/g, "");

export function validCpf(v: string): boolean {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
export function validCnpj(v: string): boolean {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = w.reduce((a, x, i) => a + x * +d[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
export const formatCpf = (v: string) => digits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
export const formatCnpj = (v: string) => digits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export const formatDoc = (v: string) => digits(v).length === 11 ? formatCpf(v) : formatCnpj(v);
export function formatPhone(v: string) {
  const d = digits(v).replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
}
const UF = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Normaliza e valida o formulário. Retorna mapa campo → mensagem (vazio = válido). */
export function validateContratante(raw: Record<string, unknown>): { value: ContratanteInput; errors: Record<string, string> } {
  const v = {
    estabelecimento_nome: clean(raw.estabelecimento_nome, 160), estabelecimento_cnpj: digits(String(raw.estabelecimento_cnpj ?? "")),
    estabelecimento_segmento: clean(raw.estabelecimento_segmento, 60),
    endereco_logradouro: clean(raw.endereco_logradouro, 160), endereco_numero: clean(raw.endereco_numero, 20), endereco_bairro: clean(raw.endereco_bairro, 80),
    endereco_cidade: clean(raw.endereco_cidade, 80), endereco_uf: clean(raw.endereco_uf, 2).toUpperCase(), endereco_cep: digits(String(raw.endereco_cep ?? "")),
    responsavel_nome: clean(raw.responsavel_nome, 120), responsavel_cpf: digits(String(raw.responsavel_cpf ?? "")),
    responsavel_email: clean(raw.responsavel_email, 160).toLowerCase(), responsavel_telefone: digits(String(raw.responsavel_telefone ?? "")),
    plan: raw.plan === "annual" ? "annual" : raw.plan === "monthly" ? "monthly" : "" as ContractPlan,
  } as ContratanteInput;
  const e: Record<string, string> = {};
  if (v.estabelecimento_nome.length < 2) e.estabelecimento_nome = "Informe o nome fantasia ou razão social.";
  if (!(v.estabelecimento_cnpj.length === 11 ? validCpf(v.estabelecimento_cnpj) : validCnpj(v.estabelecimento_cnpj))) e.estabelecimento_cnpj = "CNPJ ou CPF inválido.";
  if (!v.estabelecimento_segmento) e.estabelecimento_segmento = "Escolha o segmento.";
  if (v.endereco_logradouro.length < 3) e.endereco_logradouro = "Informe a rua.";
  if (!v.endereco_numero) e.endereco_numero = "Informe o número (ou S/N).";
  if (v.endereco_bairro.length < 2) e.endereco_bairro = "Informe o bairro.";
  if (v.endereco_cidade.length < 2) e.endereco_cidade = "Informe a cidade.";
  if (!UF.has(v.endereco_uf)) e.endereco_uf = "UF inválida.";
  if (v.endereco_cep.length !== 8) e.endereco_cep = "CEP deve ter 8 dígitos.";
  if (v.responsavel_nome.split(" ").filter(Boolean).length < 2) e.responsavel_nome = "Informe o nome completo.";
  if (!validCpf(v.responsavel_cpf)) e.responsavel_cpf = "CPF inválido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.responsavel_email)) e.responsavel_email = "E-mail inválido.";
  if (![10, 11, 12, 13].includes(v.responsavel_telefone.length)) e.responsavel_telefone = "Telefone com DDD inválido.";
  if (!v.plan) e.plan = "Escolha o plano.";
  return { value: v, errors: e };
}

export function missingContratada(c: Partial<ContratadaInfo> | null | undefined): string[] {
  const req: (keyof ContratadaInfo)[] = ["company_name", "cnpj", "address", "representative_name", "email"];
  return req.filter((k) => !String(c?.[k] ?? "").trim());
}

// ---------- Por extenso ----------
const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function upTo999(n: number): string {
  if (n === 100) return "cem";
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) parts.push(r < 20 ? UNITS[r] : TENS[Math.floor(r / 10)] + (r % 10 ? " e " + UNITS[r % 10] : ""));
  return parts.join(" e ");
}
export function numberWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  if (mi) parts.push(mi === 1 ? "um milhão" : `${upTo999(mi)} milhões`);
  if (mil) parts.push(mil === 1 ? "mil" : `${upTo999(mil)} mil`);
  if (rest) parts.push(upTo999(rest));
  // "e" antes do último grupo quando ele é < 100 ou centena exata (ex.: mil e cem, mil e vinte).
  if (parts.length > 1 && rest && (rest < 100 || rest % 100 === 0)) return parts.slice(0, -1).join(" ") + " e " + parts[parts.length - 1];
  return parts.join(" ");
}
export function moneyWords(cents: number): string {
  const r = Math.floor(cents / 100), c = cents % 100;
  const reais = r ? `${numberWords(r)}${r % 1e6 === 0 && r >= 1e6 ? " de" : ""} ${r === 1 ? "real" : "reais"}` : "";
  const cent = c ? `${numberWords(c)} ${c === 1 ? "centavo" : "centavos"}` : "";
  return [reais, cent].filter(Boolean).join(" e ") || "zero reais";
}
export const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const local = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
export const dateBr = (d: Date) => { const x = local(d); return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`; };
export const dateLong = (d: Date) => { const x = local(d); return `${x.getDate()} de ${MONTHS[x.getMonth()]} de ${x.getFullYear()}`; };

export const HASH_MARKER = "[SHA-256 DESTE TEXTO]";
export const DOC_ID_TEXT = "registrado no certificado de assinaturas da Autentique deste documento";

/** Variáveis {{...}} do modelo oficial. */
export function contractVariables(c: ContratanteInput, k: ContratadaInfo, ctx: ContractContext): Record<string, string> {
  const plan = CONTRACT_PLANS[c.plan];
  const address = `${c.endereco_logradouro}, ${c.endereco_numero} – ${c.endereco_bairro}, ${c.endereco_cidade}/${c.endereco_uf}, CEP ${c.endereco_cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`;
  return {
    CONTRATADA_RAZAO_SOCIAL: k.company_name, CONTRATADA_CNPJ: formatDoc(k.cnpj), CONTRATADA_ENDERECO: k.address, PLATAFORMA_URL: k.platform_url,
    CONTRATADA_REPRESENTANTE_NOME: k.representative_name, CONTRATADA_REPRESENTANTE_CPF: k.representative_cpf ? formatCpf(k.representative_cpf) : "", CONTRATADA_EMAIL: k.email,
    ESTABELECIMENTO_NOME: c.estabelecimento_nome, ESTABELECIMENTO_CNPJ: formatDoc(c.estabelecimento_cnpj), ESTABELECIMENTO_SEGMENTO: c.estabelecimento_segmento,
    ESTABELECIMENTO_ENDERECO: address, ESTABELECIMENTO_SLUG: ctx.slug || "não definido",
    RESPONSAVEL_NOME: c.responsavel_nome, RESPONSAVEL_CPF: formatCpf(c.responsavel_cpf), RESPONSAVEL_EMAIL: c.responsavel_email,
    RESPONSAVEL_TELEFONE: formatPhone(c.responsavel_telefone),
    PLANO_NOME: plan.name, PLANO_CICLO: plan.cycle, PLANO_LIMITE_DESCRICAO: PLAN_LIMITS,
    PLANO_VALOR_MENSAL: money(plan.cents), PLANO_VALOR_EXTENSO: moneyWords(plan.cents),
    TAXA_IMPLANTACAO_DESCRICAO: "Isenta", DIAS_TRIAL: String(ctx.trialDays),
    DATA_INICIO_TRIAL: dateBr(ctx.trialStart), DATA_FIM_TRIAL: dateBr(ctx.trialEnd), DIA_VENCIMENTO: String(local(ctx.trialEnd).getDate()),
    FORO_COMARCA_UF: k.forum, CIDADE_CONTRATO: k.city, DATA_EXTENSO_CONTRATO: dateLong(ctx.now),
    AUTENTIQUE_DOCUMENT_ID: DOC_ID_TEXT, CONTRACT_SHA256_HASH: HASH_MARKER,
  };
}

export function fillTemplate(vars: Record<string, string>, template = CONTRACT_TEMPLATE): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
    if (!(key in vars)) throw new Error(`variável sem valor: ${key}`);
    return vars[key];
  });
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Modelo ajustado à CONTRATADA: parágrafo de qualificação próprio e, sem CPF do representante, sem as menções a ele. */
export function contractTemplate(k: ContratadaInfo, template = CONTRACT_TEMPLATE): string {
  let t = template;
  const preamble = (k.preamble ?? "").replace(/\s+/g, " ").trim();
  if (preamble) {
    const line = preamble.startsWith("CONTRATADA:") ? preamble : `CONTRATADA: ${preamble}`;
    t = t.split("\n").map((l) => (l.startsWith("CONTRATADA: {{") ? line : l)).join("\n");
  }
  if (!digits(k.representative_cpf ?? "")) {
    t = t.replace(", CPF nº {{CONTRATADA_REPRESENTANTE_CPF}}", "")
      .replace("Representante: {{CONTRATADA_REPRESENTANTE_NOME}}\nCPF: {{CONTRATADA_REPRESENTANTE_CPF}}\n", "Representante: {{CONTRATADA_REPRESENTANTE_NOME}}\n");
  }
  return t;
}

/**
 * Texto final + hash. O hash é o SHA-256 do texto com o marcador no lugar do próprio hash; quem quiser conferir
 * troca o hash impresso pelo marcador e recalcula (o PDF assinado também tem seu hash próprio na Autentique).
 */
export async function renderContract(c: ContratanteInput, k: ContratadaInfo, ctx: ContractContext) {
  const draft = fillTemplate(contractVariables(c, k, ctx), contractTemplate(k));
  const hash = await sha256Hex(draft);
  return { text: draft.split(HASH_MARKER).join(hash), hash, version: CONTRACT_VERSION };
}

export async function verifyContractHash(text: string, hash: string): Promise<boolean> {
  return (await sha256Hex(text.split(hash).join(HASH_MARKER))) === hash;
}
