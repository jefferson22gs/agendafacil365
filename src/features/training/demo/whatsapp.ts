import type { DemoDb, DemoRow } from "./fixtures";
import { SALON_ID } from "./fixtures";
import { simulateAttendant, type AttendantMessage } from "./attendant";

/** Conversa do teste do atendente na demonstração (memória da aba). */
let attendantHistory: AttendantMessage[] | undefined;

/**
 * Central WhatsApp na demonstração: instância conectada, conversas com IA e equipe, contatos fictícios da "Evolution"
 * e disparo simulado. Tudo local; nenhuma chamada de rede. Telefones +55 11 90000-xxxx são fictícios.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(900000 + n).padStart(12, "0")}`;
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function seedWhatsAppDemo(db: DemoDb) {
  if (!db.whatsapp_instances?.length) db.whatsapp_instances = [{ id: id(1), salon_id: SALON_ID, instance_name: "demo_studio_bella", status: "connected", phone_number: "5511900000000", created_at: ago(90000) }];
  db.whatsapp_automation_settings ??= [{ salon_id: SALON_ID, confirmation_enabled: true, reminders_enabled: true, reminder_minutes: [1440, 120, 30, 15], cancellation_enabled: true, reschedule_enabled: true, birthday_enabled: true, birthday_coupon_enabled: true, birthday_coupon_validity_days: 30, review_enabled: true, interactive_enabled: true, chatbot_booking_enabled: false, updated_at: ago(5000) }];
  for (const salon of db.salons ?? []) if (salon.id === SALON_ID) salon.birthday_discount_percent ??= 10;
  if (db.whatsapp_messages) return;
  const talk: [string, string, [string, string, string, number, string?][]][] = [
    ["+5511900000001", "Mariana Alves", [["in", "contact", "Oi! Tem horário para corte amanhã à tarde?", 95], ["out", "ai", "Olá, Mariana! Amanhã temos 14:00 e 16:00 com a Carla. Quer reservar algum?", 94], ["in", "contact", "16h, por favor", 30]]],
    ["+5511900000002", "João Pereira", [["in", "contact", "Quero falar com um atendente", 300], ["out", "ai", "Vou deixar esta conversa para a equipe do salão. O assistente automático está pausado.", 299], ["out", "human", "Oi João, aqui é a Bella. Como posso ajudar?", 280], ["in", "contact", "Posso pagar no Pix na hora?", 12]]],
    ["+5511900000003", "Fernanda Costa", [["in", "contact", "", 1500, "image"], ["out", "ai", "Linda foto! Esse corte é o Long Bob, R$ 120. Quer agendar?", 1499]]],
    ["+5511900000004", "Lucas Oliveira", [["in", "contact", "Qual o endereço?", 4000], ["out", "ai", "Rua das Flores, 123 — Centro. Até breve!", 3999]]],
  ];
  db.whatsapp_messages = talk.flatMap(([phone, name, rows], c) => rows.map(([direction, author, body, min, type], i) => ({
    id: id(100 + c * 10 + i), salon_id: SALON_ID, phone, direction, author, body: body || (type === "image" ? "Foto de referência" : ""),
    kind: type ? "media" : "text", message_type: type ?? "text", media_url: null, payload: null, status: direction === "in" ? "received" : "read", contact_name: direction === "in" ? name : null, created_at: ago(min),
  })));
  // Lista interativa enviada pela IA e a opção escolhida (exibição no inbox).
  db.whatsapp_messages.push(
    { id: id(150), salon_id: SALON_ID, phone: "+5511900000001", direction: "out", author: "ai", body: "Escolha o serviço:", kind: "interactive", message_type: "list", payload: { options: ["Corte feminino", "Escova", "Hidratação"] }, media_url: null, status: "read", contact_name: null, created_at: ago(29) },
    { id: id(151), salon_id: SALON_ID, phone: "+5511900000001", direction: "in", author: "contact", body: "Corte feminino", kind: "interactive", message_type: "list_reply", payload: null, media_url: null, status: "received", contact_name: "Mariana Alves", created_at: ago(28) },
  );
  db.whatsapp_conversation_state = [{ id: id(200), salon_id: SALON_ID, phone: "+5511900000002", human_takeover: true, taken_over_at: ago(299), last_read_at: ago(200) }];
  db.whatsapp_marketing_suppression = [{ salon_id: SALON_ID, phone: "+5511900000004", created_at: ago(3000) }];
  db.broadcasts ??= [];
  db.broadcast_messages ??= [];
  db.scheduled_posts ??= [];
}

const EVOLUTION_CONTACTS = [
  { remoteJid: "5511900000001@s.whatsapp.net", pushName: "Mariana Alves" },
  { remoteJid: "5511900000031@s.whatsapp.net", pushName: "Paula (WhatsApp)" },
  { remoteJid: "5511900000032@s.whatsapp.net", pushName: "Ricardo (WhatsApp)" },
  { remoteJid: "14155552671@s.whatsapp.net", pushName: "Cliente internacional" },
  { remoteJid: "120363000000000000@g.us", name: "Grupo de clientes" },
  { remoteJid: "status@broadcast" },
  { remoteJid: "123456789012345@lid", pushName: "Contato oculto" },
];

type Result = { data: unknown; error: null };
const ok = (data: Record<string, unknown>): Result => ({ data: { success: true, ...data }, error: null });
const rows = (db: DemoDb, t: string) => (db[t] ??= []);

/** Edge Functions da central. `undefined` = não é da central (segue o comportamento padrão do mock). */
export function whatsappDemoFunction(db: DemoDb, name: string, body: Record<string, unknown>): Result | undefined {
  const now = new Date().toISOString();
  if (name === "whatsapp-instances") {
    if (body.action === "contacts") {
      const book = EVOLUTION_CONTACTS.filter(c => c.remoteJid.endsWith("@s.whatsapp.net")).map(c => ({ jid: c.remoteJid, phone: `+${c.remoteJid.split("@")[0]}`, name: c.pushName ?? "Contato do WhatsApp" }));
      return ok({ contacts: book, excluded: { group: 1, broadcast: 1, lid: 1, invalid: 0 }, truncated: false });
    }
    if (["status", "connect", "fetch"].includes(String(body.action))) return ok({ status: "connected", state: "open", phoneNumber: "5511900000000" });
    return undefined; // criar/desconectar/excluir: indisponível na demo
  }
  if (name === "whatsapp-reply") {
    const phone = String(body.phone);
    const state = rows(db, "whatsapp_conversation_state");
    const setTakeover = (v: boolean) => { const s = state.find(r => r.phone === phone); if (s) Object.assign(s, { human_takeover: v, taken_over_at: now }); else state.push({ id: crypto.randomUUID(), salon_id: SALON_ID, phone, human_takeover: v, taken_over_at: now }); };
    if (body.action === "takeover" || body.action === "release") { setTakeover(body.action === "takeover"); return ok({ humanTakeover: body.action === "takeover" }); }
    if (body.action === "sync") return ok({ imported: 0 });
    const prev = rows(db, "whatsapp_messages").find(m => m.client_ref === body.clientRef);
    if (prev) return ok({ duplicate: true, id: prev.id, status: prev.status });
    const msg: DemoRow = { id: crypto.randomUUID(), salon_id: SALON_ID, phone, direction: "out", author: "human", body: String(body.text ?? "").trim(), kind: "text", message_type: "text", status: "sent", client_ref: body.clientRef, created_at: now };
    rows(db, "whatsapp_messages").push(msg);
    setTakeover(true);
    return ok({ id: msg.id, status: "sent" });
  }
  if (name === "broadcast-messages-v2" || name === "broadcast-messages") {
    if (body.action === "stop_broadcast") { const b = rows(db, "broadcasts").find(x => x.id === body.broadcastId); if (b) b.status = "stopped"; return ok({ cancelledPending: 0 }); }
    if (body.action !== "create_broadcast") return undefined;
    const existing = rows(db, "broadcasts").find(b => b.idempotency_key === body.submissionId);
    if (existing) return ok({ broadcastId: existing.id });
    const recipients = (body.recipients as { phone: string; name: string }[]) ?? [];
    const scheduled = typeof body.scheduledFor === "string" && body.scheduledFor > now;
    const bId = crypto.randomUUID();
    // Simulação: o último destinatário de lotes com 3+ falha, para demonstrar o status por pessoa.
    const items = recipients.map((r, i) => ({ id: crypto.randomUUID(), broadcast_id: bId, salon_id: SALON_ID, recipient_phone: r.phone, recipient_name: r.name, status: scheduled ? "pending" : recipients.length > 2 && i === recipients.length - 1 ? "failed" : "delivered", error_message: !scheduled && recipients.length > 2 && i === recipients.length - 1 ? "provider_rejected" : null, sent_at: scheduled ? null : now, created_at: now }));
    rows(db, "broadcast_messages").push(...items);
    const failed = items.filter(i => i.status === "failed").length;
    rows(db, "broadcasts").push({ id: bId, salon_id: SALON_ID, message: body.message, idempotency_key: body.submissionId, status: scheduled ? "scheduled" : "completed", total_recipients: items.length, sent_count: scheduled ? 0 : items.length - failed, failed_count: scheduled ? 0 : failed, scheduled_for: body.scheduledFor ?? now, created_at: now, completed_at: scheduled ? null : now });
    return ok({ broadcastId: bId, message: "Campanha simulada na demonstração." });
  }
  if (name === "whatsapp-chatbot" && body.action === "test") {
    // Atendente simulado (roteiro local): segue o mesmo fluxo do WhatsApp real com serviços/profissionais da demonstração.
    const history = (attendantHistory ??= []);
    if (/^(recome[cç]ar|reiniciar|limpar)$/i.test(String(body.text).trim())) history.length = 0;
    history.push({ role: "user", content: String(body.text).slice(0, 500) });
    const salon = rows(db, "salons").find(s => s.id === SALON_ID);
    const r = simulateAttendant(history, rows(db, "services").filter(s => s.salon_id === SALON_ID && s.is_active !== false) as never, { professionals: rows(db, "professionals").filter(p => p.salon_id === SALON_ID && p.is_active !== false) as never, salonName: String(salon?.name ?? "Studio Bella"), phone: "+5511900000009" });
    history.push({ role: "assistant", content: r.reply });
    if (r.step === "done") history.length = 0;
    return ok({ text: r.reply, provider: "demo", model: `demo_${r.step}`, preview: true });
  }
  if (name === "whatsapp-status" && body.action === "save") {
    const [date, time] = String(body.localDateTime).split("T");
    const post = { id: String(body.id), salon_id: SALON_ID, content_type: body.contentType, text_content: body.text, media_path: null, media_url: "", media_filename: null, scheduled_at: new Date(`${date}T${time}`).toISOString(), recurrence_type: body.recurrenceType ?? "once", recurrence_days: body.recurrenceDays ?? [], recurrence_end_date: body.endDate ?? null, status: "scheduled", created_at: now };
    const list = rows(db, "scheduled_posts"), prev = list.findIndex(p => p.id === post.id);
    if (prev >= 0) list[prev] = { ...list[prev], ...post }; else list.push(post);
    return ok({ id: post.id });
  }
  return undefined;
}

/** RPCs da caixa de entrada. */
export function whatsappDemoRpc(db: DemoDb, name: string, args: Record<string, unknown>): Result | undefined {
  if (name === "whatsapp_mark_conversation_read") {
    const state = rows(db, "whatsapp_conversation_state"), s = state.find(r => r.phone === args.p_phone);
    if (s) s.last_read_at = new Date().toISOString(); else state.push({ id: crypto.randomUUID(), salon_id: args.p_salon_id, phone: args.p_phone, human_takeover: false, last_read_at: new Date().toISOString() });
    return { data: null, error: null };
  }
  if (name !== "whatsapp_inbox_conversations") return undefined;
  const msgs = rows(db, "whatsapp_messages").filter(m => m.salon_id === args.p_salon_id);
  const phones = [...new Set(msgs.filter(m => m.direction === "in").map(m => String(m.phone)))];
  const data = phones.map(phone => {
    const thread = msgs.filter(m => m.phone === phone).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const last = thread[thread.length - 1], state = rows(db, "whatsapp_conversation_state").find(s => s.phone === phone);
    const client = rows(db, "clients").find(c => c.phone_normalized === phone);
    return { phone, contact_name: client?.name ?? [...thread].reverse().find(m => m.contact_name)?.contact_name ?? null, last_body: last.body, last_kind: last.kind ?? "text", last_type: last.message_type, last_author: last.author, last_direction: last.direction, last_at: last.created_at,
      unread: msgs.filter(m => m.phone === phone && m.direction === "in" && String(m.created_at) > String(state?.last_read_at ?? "")).length, human_takeover: !!state?.human_takeover, taken_over_at: state?.taken_over_at ?? null };
  }).sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)));
  return { data, error: null };
}
