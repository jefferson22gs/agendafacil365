import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEMO_STORAGE_KEY, DEMO_UNAVAILABLE } from "@/config/demo";
import { createFixtures, USER_ID, type DemoDb, type DemoRow } from "./fixtures";
import { seedWhatsAppDemo, whatsappDemoFunction, whatsappDemoRpc } from "./whatsapp";

/**
 * SupabaseClient falso dos modos demo/training (alias em vite.isolation.ts; produção nunca importa este arquivo).
 * Banco em memória: leituras com filtros/joins/ordem, escritas reais (insert/update/upsert/delete).
 * Persistido por aba em sessionStorage (sobrevive a F5); "Reiniciar demonstração" apaga a chave e recarrega.
 */
const today = new Date().toDateString();
function load(): DemoDb {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_STORAGE_KEY) ?? "null");
    // Outro dia = datas relativas envelhecidas: recomeça do seed.
    if (saved?.day === today && saved.db && typeof saved.db === "object") return saved.db;
  } catch { /* storage bloqueado ou JSON inválido: usa o seed */ }
  return createFixtures();
}
const db = load();
seedWhatsAppDemo(db); // Central WhatsApp: conversas, contatos e disparo simulados
function persist() {
  try { sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ day: today, db })); } catch { /* cota/bloqueio: segue só em memória */ }
}
const blocked = (what: string) => { try { window.dispatchEvent(new CustomEvent("demo:blocked", { detail: what })); } catch { /* sem window */ } };

// Views/joins ----------------------------------------------------------------
const singular = (t: string) => t.replace(/s$/, "");
function view(table: string): DemoRow[] {
  if (table !== "service_packages_with_items") return db[table] ?? [];
  return (db.service_packages ?? []).map((p) => {
    const items = (db.service_package_items ?? []).filter((i) => i.package_id === p.id).map((i) => {
      const s = (db.services ?? []).find((x) => x.id === i.service_id);
      return { id: i.id, service_id: i.service_id, quantity: i.quantity, service_name: s?.name, service_price: s?.price };
    });
    return { ...p, items: items.length ? items : null };
  });
}
/** Divide "a, b:c (x, y), d" no nível 0 de parênteses. */
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
type Embed = { alias: string; table: string; fk: string };
/** `services:service_id (..)`, `client:clients(..)`, `referrer:clients!referrer_id(..)`, `services (..)` → sempre a-um. */
function parseEmbeds(columns: string): Embed[] {
  return splitTop(columns.replace(/\s+/g, " ")).filter((c) => c.includes("(")).map((c) => {
    const head = c.slice(0, c.indexOf("(")).trim();
    const [alias, target = alias] = head.includes(":") ? head.split(":").map((x) => x.trim()) : [head, head];
    const [name, hint] = target.split("!");
    if (hint) return { alias, table: name, fk: hint };
    if (name in db || name === alias) return { alias, table: name, fk: name === alias ? `${singular(name)}_id` : `${alias}_id` };
    return { alias, table: alias, fk: name }; // alias:fk_column
  });
}
const num = (v: unknown) => (typeof v === "number" ? v : Number.NaN);
function cmp(a: unknown, b: unknown) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}
const likeRe = (p: string) => new RegExp(`^${String(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i");

// Query builder --------------------------------------------------------------
type Result = { data: unknown; error: null; count: number | null; status: number; statusText: string };
type Filter = (r: DemoRow) => boolean;
const op = (key: string, o: string, v: unknown): Filter => {
  switch (o) {
    case "eq": return (r) => r[key] === v || (typeof r[key] === "number" && r[key] === Number(v)) || (typeof r[key] === "boolean" && String(r[key]) === v);
    case "neq": return (r) => r[key] !== v;
    case "is": return (r) => (v === null || v === "null" ? r[key] == null : r[key] === v || String(r[key]) === v);
    case "in": return (r) => (v as unknown[]).includes(r[key]);
    case "gt": return (r) => (typeof v === "number" ? num(r[key]) > v : String(r[key] ?? "") > String(v));
    case "gte": return (r) => (typeof v === "number" ? num(r[key]) >= v : String(r[key] ?? "") >= String(v));
    case "lt": return (r) => (typeof v === "number" ? num(r[key]) < v : r[key] != null && String(r[key]) < String(v));
    case "lte": return (r) => (typeof v === "number" ? num(r[key]) <= v : r[key] != null && String(r[key]) <= String(v));
    case "like": case "ilike": return (r) => likeRe(String(v)).test(String(r[key] ?? ""));
    default: return () => true; // contains/overlaps etc.: sem uso relevante nas telas
  }
};
const DEFAULT_ACTIVE = new Set(["services", "professionals", "products", "coupons", "service_packages", "salons", "referral_codes", "push_subscriptions"]);

class DemoQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { key: string; asc: boolean }[] = [];
  private columns = "*";
  private singleResult = false;
  private head = false;
  private take = Infinity;
  private offset = 0;
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private values: DemoRow[] = [];
  private conflict = "id";
  constructor(private table: string) {}
  select(columns = "*", options?: { head?: boolean; count?: string }) { this.columns = columns; this.head = !!options?.head; return this; }
  eq(k: string, v: unknown) { this.filters.push(op(k, "eq", v)); return this; }
  neq(k: string, v: unknown) { this.filters.push(op(k, "neq", v)); return this; }
  is(k: string, v: unknown) { this.filters.push(op(k, "is", v)); return this; }
  in(k: string, v: unknown[]) { this.filters.push(op(k, "in", v)); return this; }
  gt(k: string, v: unknown) { this.filters.push(op(k, "gt", v)); return this; }
  gte(k: string, v: unknown) { this.filters.push(op(k, "gte", v)); return this; }
  lt(k: string, v: unknown) { this.filters.push(op(k, "lt", v)); return this; }
  lte(k: string, v: unknown) { this.filters.push(op(k, "lte", v)); return this; }
  like(k: string, v: string) { this.filters.push(op(k, "like", v)); return this; }
  ilike(k: string, v: string) { this.filters.push(op(k, "ilike", v)); return this; }
  not(k: string, o: string, v: unknown) { const f = op(k, o, v); this.filters.push((r) => !f(r)); return this; }
  match(q: DemoRow) { Object.entries(q).forEach(([k, v]) => this.eq(k, v)); return this; }
  /** "a.eq.1,b.ilike.%x%" (sem grupos aninhados). */
  or(expr: string) {
    const parts = expr.split(",").map((p) => { const [k, o, ...rest] = p.split("."); return op(k, o, rest.join(".")); });
    this.filters.push((r) => parts.some((f) => f(r))); return this;
  }
  contains() { return this; }
  filter(k: string, o: string, v: unknown) { this.filters.push(op(k, o, v)); return this; }
  order(key: string, opts?: { ascending?: boolean; foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) this.orders.push({ key, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.take = n; return this; }
  range(from: number, to: number) { this.offset = from; this.take = to - from + 1; return this; }
  single() { this.singleResult = true; return this; }
  maybeSingle() { this.singleResult = true; return this; }
  throwOnError() { return this; }
  abortSignal() { return this; }
  returns() { return this; }
  insert(v: DemoRow | DemoRow[]) { this.action = "insert"; this.values = [v].flat(); return this; }
  upsert(v: DemoRow | DemoRow[], opts?: { onConflict?: string }) { this.action = "upsert"; this.values = [v].flat(); this.conflict = opts?.onConflict ?? "id"; return this; }
  update(v: DemoRow) { this.action = "update"; this.values = [v]; return this; }
  delete() { this.action = "delete"; return this; }

  private write(): DemoRow[] {
    const rows = (db[this.table] ??= []);
    const now = new Date().toISOString();
    const match = (r: DemoRow) => this.filters.every((f) => f(r));
    const create = (v: DemoRow) => {
      const row: DemoRow = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...(DEFAULT_ACTIVE.has(this.table) ? { is_active: true } : {}), ...v };
      rows.push(row); return row;
    };
    let out: DemoRow[] = [];
    if (this.action === "insert") out = this.values.map(create);
    if (this.action === "upsert") {
      const keys = this.conflict.split(",").map((k) => k.trim());
      out = this.values.map((v) => {
        const prev = rows.find((r) => keys.every((k) => v[k] !== undefined && r[k] === v[k]));
        return prev ? Object.assign(prev, v, { updated_at: now }) : create(v);
      });
    }
    // update/delete sem filtro seria "tabela inteira": o PostgREST recusa, aqui também é no-op.
    if (this.action === "update" && this.filters.length) out = rows.filter(match).map((r) => Object.assign(r, this.values[0], { updated_at: now }));
    if (this.action === "delete" && this.filters.length) { out = rows.filter(match); db[this.table] = rows.filter((r) => !match(r)); }
    persist();
    return out;
  }
  private execute(): Result {
    const base = this.action === "select" ? view(this.table).filter((r) => this.filters.every((f) => f(r))) : this.write();
    const embeds = parseEmbeds(this.columns);
    let rows = base.map((r) => {
      const row: DemoRow = { ...r };
      for (const e of embeds) { const t = (db[e.table] ?? []).find((x) => x.id === r[e.fk]); row[e.alias] = t ? { ...t } : null; }
      return row;
    });
    if (this.orders.length) rows = [...rows].sort((a, b) => { for (const o of this.orders) { const c = cmp(a[o.key], b[o.key]); if (c) return o.asc ? c : -c; } return 0; });
    const count = rows.length;
    rows = rows.slice(this.offset, this.offset + this.take);
    const data = this.head ? null : this.singleResult ? rows[0] ?? null : rows;
    return { data, error: null, count, status: 200, statusText: "OK" };
  }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }
}

// RPC ------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function analytics(salonId: unknown, period: string) {
  const days = { week: 7, month: 30, quarter: 90, year: 365 }[period] ?? 30;
  const start = new Date(); start.setDate(start.getDate() - days);
  const [from, to] = [ymd(start), ymd(new Date())];
  const appts = (db.appointments ?? []).filter((a) => a.salon_id === salonId && (a.date as string) >= from && (a.date as string) <= to);
  const done = appts.filter((a) => a.status === "completed");
  const cancelled = appts.filter((a) => a.status === "cancelled").length;
  const revenue = done.reduce((s, a) => s + Number(a.final_price || 0), 0);
  const group = (key: string, table: string) => Object.values(done.reduce<Record<string, { id: unknown; name: unknown; count: number; revenue: number }>>((acc, a) => {
    const id = String(a[key]); const name = (db[table] ?? []).find((x) => x.id === a[key])?.name ?? "—";
    acc[id] ??= { id: a[key], name, count: 0, revenue: 0 }; acc[id].count++; acc[id].revenue += Number(a.final_price || 0); return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue);
  const ratings = (id: unknown) => { const r = (db.reviews ?? []).filter((x) => x.professional_id === id).map((x) => Number(x.rating)); return r.length ? Math.round((r.reduce((s, x) => s + x, 0) / r.length) * 10) / 10 : null; };
  return {
    period, start_date: from, total_revenue: revenue, total_appointments: appts.length, completed_appointments: done.length, cancelled_appointments: cancelled,
    cancellation_rate: appts.length ? Math.round((cancelled / appts.length) * 1000) / 10 : 0,
    new_clients: (db.clients ?? []).filter((c) => c.salon_id === salonId && String(c.created_at) >= start.toISOString()).length,
    avg_ticket: done.length ? Math.round((revenue / done.length) * 100) / 100 : 0,
    top_services: group("service_id", "services").slice(0, 5).map(({ name, count, revenue }) => ({ name, count, revenue })),
    top_professionals: group("professional_id", "professionals").map(({ id, name, count, revenue }) => ({ name, appointments: count, revenue, avg_rating: ratings(id) })),
    revenue_by_day: [0, 1, 2, 3, 4, 5, 6].map((d) => { const x = done.filter((a) => new Date(`${a.date}T12:00:00`).getDay() === d); return { day_of_week: d, revenue: x.reduce((s, a) => s + Number(a.final_price || 0), 0), appointments: x.length }; }),
    hourly_distribution: Array.from({ length: 11 }, (_, i) => i + 9).map((hour) => ({ hour, count: appts.filter((a) => parseInt(String(a.start_time)) === hour).length })),
  };
}
// Push na demo: preferências em memória, aparelhos e histórico fictícios. Nenhum envio real.
const pushPrefs: Record<string, unknown> = { new_appointment: true, appointment_cancelled: true, appointment_rescheduled: true, whatsapp_human: true,
  payment_proof: true, new_review: true, client_reminder: true, client_status: true, client_review_request: true, reminder_minutes: 120 };
function pushDemoRpc(name: string, args: Record<string, unknown>): unknown {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  if (name === "push_get_preferences") return { ...pushPrefs };
  if (name === "push_set_preferences") { Object.assign(pushPrefs, args.p_prefs ?? {}); return { ...pushPrefs }; }
  if (name === "push_overview") return {
    configured: true, my_devices: 1, team_devices: 2, client_devices: 12, marketing_devices: 10, legacy_devices: 0, campaigns_today: 0,
    history: [
      { kind: "new_appointment", audience: "owner", title: "Novo agendamento", status: "sent", sent_count: 2, failed_count: 0, last_error: null, created_at: ago(35) },
      { kind: "client_reminder", audience: "appointment", title: "Lembrete de horário", status: "sent", sent_count: 1, failed_count: 0, last_error: null, created_at: ago(120) },
      { kind: "marketing", audience: "subscribers", title: "Novidade", status: "sent", sent_count: 9, failed_count: 1, last_error: "partial", created_at: ago(1500) },
    ],
  };
  if (name === "push_enqueue_campaign") { blocked("push"); return { queued: false, recipients: 0 }; }
  if (name === "push_health") return { configured: true, last_run_at: ago(1), last_success_at: ago(1), last_error: null, sent_24h: 40, failed_24h: 1, pending: 0, expired_24h: 0, removed_24h: 1, active_subscriptions: 15, legacy_inactive: 0 };
  return null;
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const wa = whatsappDemoRpc(db, name, args);
  if (wa) { persist(); return { ...wa, count: null, status: 200, statusText: "OK" }; }
  let data: unknown = null;
  if (name === "get_salon_analytics") data = analytics(args.p_salon_id, String(args.p_period ?? "month"));
  else if (name === "get_my_ai_usage") data = [{ salon_id: args.p_salon_id ?? null, requests: 42, tokens: 18350, limit_requests: 500, limit_tokens: null, blocked: false, by_feature: { chatbot: 35, texto: 5, legenda: 2 } }];
  else if (name.includes("time_slots")) data = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
  else if (name.startsWith("push_")) data = pushDemoRpc(name, args);
  else if (name === "whatsapp_import_contacts") {
    const contacts = (args.p_contacts as DemoRow[]) ?? []; const clients = (db.clients ??= []); let imported = 0;
    for (const c of contacts) if (!clients.some((x) => x.salon_id === args.p_salon_id && x.phone === c.phone)) { clients.push({ id: crypto.randomUUID(), salon_id: args.p_salon_id, created_at: new Date().toISOString(), ...c }); imported++; }
    persist(); data = { imported, existing: contacts.length - imported };
  }
  return { data, error: null, count: null, status: 200, statusText: "OK" };
}

// Auth/functions/storage -----------------------------------------------------
const user = { id: USER_ID, email: "demo@example.com", app_metadata: {}, user_metadata: { full_name: "Administrador Demo" }, aud: "authenticated", created_at: new Date().toISOString() };
// Não é um token válido. Existe apenas para manter o formato esperado pelo código real.
const session = { user, access_token: "DEMO-NOT-A-TOKEN", refresh_token: "DEMO-NOT-A-TOKEN", token_type: "bearer", expires_at: 4102444800 };
const channel = { on() { return this; }, subscribe(callback?: (status: string) => void) { callback?.("SUBSCRIBED"); return this; }, unsubscribe: async () => "ok" };
// Disparadas em segundo plano após ações do usuário: falham em silêncio, sem aviso.
const SILENT = new Set(["auto-appointment-confirmation", "send-push-notification", "whatsapp-status", "infinitepay-checkout"]);
// Mesmo formato do FunctionsHttpError real: corpo em error.context (Response) com { error: "demo_unavailable" }.
const unavailable = () => Object.assign(new Error(DEMO_UNAVAILABLE), {
  name: "FunctionsHttpError",
  context: new Response(JSON.stringify({ error: "demo_unavailable" }), { status: 403, headers: { "Content-Type": "application/json" } }),
});
// IA na demo: texto fictício local, nunca rede (provedor/chave só existem no servidor real).
const AI_DEMO: Record<string, (body: Record<string, unknown>) => unknown> = {
  "generate-text-content": (b) => ({ success: true, text: `✨ ${String(b.text || "Novidade no salão!").slice(0, 300)}

Agende seu horário, {nome}! 💇‍♀️ (texto de exemplo da demonstração)` }),
  "generate-image-caption": () => ({ success: true, caption: "Resultado lindo de hoje no salão ✨ (legenda de exemplo da demonstração)" }),
};
const mock = {
  from: (table: string) => new DemoQuery(table),
  rpc,
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: { session, user }, error: null }),
    signUp: async () => ({ data: { session, user }, error: null }),
    signOut: async () => ({ error: null }),
    refreshSession: async () => ({ data: { session }, error: null }),
    updateUser: async () => ({ data: { user }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  functions: { invoke: async (name: string, options?: { body?: Record<string, unknown> }) => { if (AI_DEMO[name]) return { data: AI_DEMO[name](options?.body ?? {}), error: null }; if (!SILENT.has(name)) blocked(`function:${name}`); return { data: null, error: unavailable() }; } },
  storage: { from: () => ({
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
    upload: async () => { blocked("upload"); return { data: null, error: unavailable() }; },
    remove: async () => ({ data: [], error: null }), list: async () => ({ data: [], error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
  }) },
  channel: () => Object.create(channel), removeChannel: async () => "ok", removeAllChannels: async () => [],
};
// Central WhatsApp: Edge Functions simuladas localmente (sem rede); demais seguem o invoke acima.
const baseInvoke = mock.functions.invoke as (name: string, options?: { body?: Record<string, unknown> }) => Promise<unknown>;
mock.functions.invoke = (async (name: string, options?: { body?: Record<string, unknown> }) => {
  const wa = whatsappDemoFunction(db, name, options?.body ?? {});
  if (wa) { persist(); return wa; }
  return baseInvoke(name, options);
}) as typeof mock.functions.invoke;
// Adaptação na fronteira demo/treinamento: produção usa o SupabaseClient real, este arquivo nunca é importado por ele.
export const supabase = mock as unknown as SupabaseClient<Database>;
