import { LEGACY_PLAN_NAME } from "@/config/brand";
import { DEMO_SALON_SLUG } from "@/config/demo";

/**
 * Dados fictícios da demonstração/treinamento. Tudo inventado; datas relativas a "hoje" para a demo nunca envelhecer.
 * Colunas = as que as telas leem (src/integrations/supabase/types.ts + queries das páginas).
 * Gerador determinístico (mesma semente) para a mesma data produzir os mesmos dados.
 */
export type DemoRow = Record<string, unknown>;
export type DemoDb = Record<string, DemoRow[]>;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const USER_ID = uid(1);
export const SALON_ID = uid(10);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const phone = (n: number) => `(11) 90000-${String(n).padStart(4, "0")}`;

export function createFixtures(now = new Date()): DemoDb {
  // mulberry32: aleatório reprodutível, sem dependência.
  let seed = 365;
  const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const base = { salon_id: SALON_ID, created_at: addDays(today, -200).toISOString(), updated_at: now.toISOString(), is_active: true };

  const workingHours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), { isOpen: d !== 0, start: "09:00", end: d === 6 ? "16:00" : "19:00" }]));
  const salon = {
    ...base, id: SALON_ID, owner_id: USER_ID, name: "Studio Bella Demo", slug: DEMO_SALON_SLUG, business_name: "Studio Bella Demo",
    description: "Salão fictício para demonstração do Agenda Fácil 365. Nenhum dado é real.",
    phone: "(11) 90000-0000", whatsapp: "11900000000", email: "contato@example.com", cnpj: "", pix_key: "",
    address: "Rua Exemplo, 100 - Centro", city: "São Paulo", state: "SP", zip_code: "01000-000", timezone: "America/Sao_Paulo",
    logo_url: null, primary_color: "#2563EB", public_booking_enabled: true, is_franchise: false, group_id: null,
    working_days: [1, 2, 3, 4, 5, 6], opening_time: "09:00", closing_time: "19:00", working_hours: workingHours,
    lunch_break_config: { enabled: true, start_time: "12:00", end_time: "13:00", days: [1, 2, 3, 4, 5] },
  };

  const services = [
    ["Corte Feminino", "Corte personalizado com lavagem e finalização.", 80, 60, "✂️"],
    ["Corte Masculino", "Corte na máquina e tesoura, com acabamento.", 45, 30, "💈"],
    ["Escova Modeladora", "Escova com modelagem e proteção térmica.", 60, 45, "💇"],
    ["Coloração", "Coloração completa com produtos profissionais.", 180, 120, "🎨"],
    ["Manicure e Pedicure", "Cuidado completo de mãos e pés.", 70, 60, "💅"],
    ["Hidratação Capilar", "Tratamento de hidratação profunda.", 90, 45, "🧴"],
  ].map(([name, description, price, duration_minutes, icon], i) => ({ ...base, id: uid(30 + i), name, description, price, duration_minutes, icon }));

  const proHours = { start: "09:00", end: "19:00" };
  const professionals = [
    ["Ana Souza", "Cabelos femininos", 40, [0, 2, 5], USER_ID],
    ["Bruno Lima", "Barbearia", 35, [1], null],
    ["Carla Mendes", "Coloração e tratamentos", 40, [3, 0, 5], null],
    ["Daniela Rocha", "Manicure e pedicure", 30, [4], null],
  ].map(([name, specialty, rate, svc, user], i) => ({
    ...base, id: uid(20 + i), user_id: user, name, specialty, commission_rate: rate, svc: svc as number[],
    email: `${String(name).split(" ")[0].toLowerCase()}@example.com`, phone: phone(900 + i), slug: String(name).toLowerCase().replace(/\s+/g, "-"),
    bio: `Profissional fictícia da demonstração (${specialty}).`, avatar_url: null, portfolio_urls: [], public_profile_enabled: true,
    is_autonomous: false, working_days: [1, 2, 3, 4, 5, 6], working_hours: proHours,
  }));

  const names = ["Mariana Alves", "João Pereira", "Fernanda Costa", "Lucas Oliveira", "Juliana Santos", "Rafael Souza", "Camila Ribeiro",
    "Pedro Martins", "Beatriz Carvalho", "Gabriel Ferreira", "Larissa Gomes", "Thiago Barbosa", "Amanda Rodrigues", "Felipe Araújo",
    "Patrícia Lima", "Rodrigo Teixeira", "Aline Moreira", "Gustavo Dias", "Renata Castro", "Diego Nunes", "Isabela Freitas",
    "Marcelo Pinto", "Letícia Cardoso", "André Correia", "Vanessa Rocha"];
  const clients = names.map((name, i) => ({
    ...base, id: uid(100 + i), user_id: i === 0 ? USER_ID : null, name, phone: phone(i + 1),
    email: `${name.split(" ")[0].normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase()}.${i + 1}@example.com`,
    notes: i % 5 === 0 ? "Prefere horários pela manhã." : null,
    preferences: i % 3 === 0 ? { birth_date: `19${85 + (i % 15)}-${pad((i % 12) + 1)}-${pad((i % 27) + 1)}` } : {},
    created_at: addDays(today, -(i < 20 ? 180 - i * 7 : 25 - (i - 20) * 5)).toISOString(),
    total_visits: 0, total_spent: 0, loyalty_points: 0, last_visit_at: null as string | null,
  }));

  const coupons = [
    { ...base, id: uid(70), code: "BEMVINDA10", type: "percentage", value: 10, min_purchase: 50, max_uses: 100, uses_count: 23, valid_from: addDays(today, -30).toISOString(), valid_until: addDays(today, 60).toISOString(), is_new_clients_only: true },
    { ...base, id: uid(71), code: "FIDELIDADE20", type: "fixed", value: 20, min_purchase: 100, max_uses: 50, uses_count: 8, valid_from: addDays(today, -15).toISOString(), valid_until: addDays(today, 45).toISOString(), is_new_clients_only: false },
  ];

  // Agenda: 60 dias para trás, 14 para frente. Cada profissional pega horários livres em sequência (sem sobreposição).
  const appointments: DemoRow[] = [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let d = -60; d <= 14; d++) {
    const day = addDays(today, d);
    if (day.getDay() === 0) continue;
    const close = day.getDay() === 6 ? 16 * 60 : 19 * 60;
    for (const pro of professionals) {
      let t = 9 * 60;
      while (t < close) {
        if (t >= 12 * 60 && t < 13 * 60 && day.getDay() !== 6) { t = 13 * 60; continue; }
        const busy = d < 0 ? 0.5 : d === 0 ? 0.7 : d <= 7 ? 0.45 : 0.25;
        if (rand() > busy) { t += 30; continue; }
        const svc = services[pick(pro.svc)];
        const dur = svc.duration_minutes as number;
        if (t + dur > close || (day.getDay() !== 6 && t < 12 * 60 && t + dur > 12 * 60)) { t += 30; continue; }
        const r = rand();
        const past = d < 0 || (d === 0 && t + dur <= nowMin);
        const status = past ? (r < 0.08 ? "cancelled" : r < 0.12 ? "no_show" : "completed") : r < 0.68 ? "confirmed" : r < 0.92 ? "pending" : "cancelled";
        const client = pick(clients);
        const coupon = rand() < 0.1 ? coupons[0] : null;
        const price = svc.price as number;
        const discount = coupon ? Math.round(price * 0.1 * 100) / 100 : 0;
        const created = d <= 0 ? addDays(day, -Math.floor(rand() * 6)) : addDays(today, -Math.floor(rand() * 5));
        appointments.push({
          id: uid(10000 + appointments.length), salon_id: SALON_ID, client_id: client.id, client_name: client.name, client_phone: client.phone,
          client_birthday: null, service_id: svc.id, professional_id: pro.id, coupon_id: coupon?.id ?? null, date: ymd(day),
          start_time: hhmm(t), end_time: hhmm(t + dur), status, price, discount, final_price: price - discount,
          // total_price/original_price/discount_amount: lidos por BI/metas e telas legadas (mesmo valor).
          total_price: price - discount, original_price: price, discount_amount: discount,
          notes: coupon ? `Cupom ${coupon.code}` : null, created_at: at(created, 8 + Math.floor(rand() * 10)), updated_at: now.toISOString(),
        });
        t += Math.ceil(dur / 30) * 30;
      }
    }
  }

  const done = appointments.filter((a) => a.status === "completed");
  for (const c of clients) {
    const mine = done.filter((a) => a.client_id === c.id);
    c.total_visits = mine.length;
    c.total_spent = mine.reduce((s, a) => s + (a.final_price as number), 0);
    c.loyalty_points = Math.floor(c.total_spent);
    const last = mine.map((a) => a.date as string).sort().pop();
    c.last_visit_at = last ? `${last}T12:00:00.000Z` : null;
  }

  const comments = ["Atendimento excelente, voltarei com certeza!", "Adorei o resultado, super recomendo.", "Ambiente agradável e pontualidade.",
    "Muito caprichosa, ficou perfeito.", "Bom atendimento, só atrasou um pouco.", "Melhor salão da região!", null];
  const reviews = done.filter((a) => (a.date as string) >= ymd(addDays(today, -45))).filter((_, i) => i % 9 === 0).slice(0, 16).map((a, i) => ({
    id: uid(800 + i), salon_id: SALON_ID, appointment_id: a.id, client_id: a.client_id, professional_id: a.professional_id,
    rating: i % 7 === 4 ? 3 : i % 3 === 0 ? 4 : 5, comment: comments[i % comments.length], is_public: true,
    response: i % 4 === 0 ? "Obrigada pelo carinho! Esperamos você em breve." : null,
    response_at: i % 4 === 0 ? at(addDays(today, -1), 10) : null, created_at: at(new Date(`${a.date}T12:00:00`), 20),
  }));

  const tiers = [["Bronze", 0, 0, "🥉", "#CD7F32"], ["Prata", 200, 5, "🥈", "#C0C0C0"], ["Ouro", 500, 10, "🥇", "#FFD700"], ["Diamante", 1000, 15, "💎", "#38BDF8"]]
    .map(([name, min_points, discount_percent, icon, color], i) => ({
      id: uid(400 + i), salon_id: SALON_ID, name, min_points, discount_percent, icon, color, sort_order: i,
      benefits: [`${discount_percent}% de desconto em serviços`, ...(i >= 2 ? ["Prioridade no agendamento"] : [])],
    }));
  const tierFor = (p: number) => [...tiers].reverse().find((t) => p >= (t.min_points as number))!;
  const withPoints = clients.filter((c) => c.loyalty_points > 0);
  const loyaltyPoints = withPoints.map((c, i) => ({ id: uid(450 + i), salon_id: SALON_ID, client_id: c.id, points: c.loyalty_points, lifetime_points: c.loyalty_points + 50, current_tier_id: tierFor(c.loyalty_points).id }));
  const loyaltyTransactions = withPoints.map((c, i) => ({ id: uid(500 + i), salon_id: SALON_ID, client_id: c.id, type: "earned", points: c.loyalty_points + 50, description: "Pontos por atendimentos", created_at: c.last_visit_at }));
  const loyaltyRedemptions = [100, 200, 150].map((points_used, i) => ({ id: uid(550 + i), salon_id: SALON_ID, client_id: withPoints[i]?.id ?? clients[i].id, points_used, created_at: now.toISOString() }));

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const packages = [
    { id: uid(60), name: "Pacote Noiva", description: "Escovas, hidratações e manicure para o grande dia.", discount_percent: 15, items: [[2, 2], [5, 2], [4, 1]] },
    { id: uid(61), name: "Cabelo em Dia", description: "Corte + 3 hidratações para usar em até 6 meses.", discount_percent: 10, items: [[0, 1], [5, 3]] },
  ];
  const packageItems = packages.flatMap((p, pi) => p.items.map(([s, quantity], i) => ({ id: uid(650 + pi * 10 + i), package_id: p.id, service_id: services[s].id, quantity })));
  const servicePackages = packages.map((p) => {
    const total = p.items.reduce((sum, [s, q]) => sum + (services[s].price as number) * q, 0);
    return { ...base, id: p.id, name: p.name, description: p.description, discount_percent: p.discount_percent, validity_days: p.id === uid(60) ? 90 : 180, price: Math.round(total * (1 - p.discount_percent / 100) * 100) / 100, quantity: null, service_id: null };
  });

  const upcoming = appointments.filter((a) => (a.date as string) >= ymd(today) && a.status !== "cancelled").slice(0, 5);
  const svcName = (id: unknown) => services.find((s) => s.id === id)?.name;

  return {
    profiles: [{ id: USER_ID, user_id: USER_ID, full_name: "Administrador Demo", phone: "(11) 90000-0000", avatar_url: null, created_at: base.created_at }],
    // admin + professional + client: permite navegar no painel, no painel do profissional (/professional) e no perfil (/profile).
    user_roles: ["admin", "professional", "client"].map((role, i) => ({ id: uid(2 + i), user_id: USER_ID, role, salon_id: SALON_ID, created_at: base.created_at })),
    salons: [salon],
    services,
    professionals: professionals.map(({ svc: _svc, ...p }) => p),
    clients,
    appointments,
    coupons,
    products: [["Shampoo Reconstrutor", 59.9, 12, "Cabelos"], ["Condicionador Nutritivo", 54.9, 9, "Cabelos"], ["Máscara Hidratante", 79.9, 6, "Tratamentos"],
      ["Óleo Finalizador", 49.9, 15, "Finalização"], ["Pomada Modeladora", 39.9, 20, "Barbearia"]]
      .map(([name, price, stock, category], i) => ({ ...base, id: uid(80 + i), name, description: "Produto fictício da demonstração.", price, stock, category, image_url: null })),
    service_packages: servicePackages,
    service_package_items: packageItems,
    reviews,
    subscriptions: [{
      id: uid(90), salon_id: SALON_ID, user_id: USER_ID, status: "active", is_trial: false, plan_name: LEGACY_PLAN_NAME, plan_type: "monthly", plan_id: null,
      amount: 39.9, currency: "BRL", current_period_start: addDays(today, -10).toISOString(), current_period_end: addDays(today, 20).toISOString(),
      next_payment_date: addDays(today, 20).toISOString(), trial_start_date: null, trial_end_date: null, created_at: addDays(today, -120).toISOString(), updated_at: now.toISOString(),
    }],
    salon_insights: [
      ["idle_hours", "Horários ociosos na terça à tarde", "Terças entre 14h e 17h têm baixa ocupação. Que tal um cupom para esse horário?", "medium", "send_coupon"],
      ["inactive_clients", "5 clientes sem visitar há mais de 45 dias", "Envie uma mensagem de retorno para reativar esses clientes.", "high", "view_clients"],
      ["revenue_trend", "Faturamento em alta", "O faturamento das últimas 4 semanas cresceu em relação ao mês anterior.", "low", null],
    ].map(([insight_type, title, message, priority, action_type], i) => ({ id: uid(300 + i), salon_id: SALON_ID, insight_type, title, message, priority, action_type, action_data: null, is_read: false, is_dismissed: false, expires_at: null, created_at: at(today, 8) })),
    client_metrics: clients.filter((c) => c.total_visits > 0).slice(0, 8).map((c, i) => ({
      id: uid(350 + i), salon_id: SALON_ID, client_id: c.id, churn_risk: ["low", "medium", "high"][i % 3], avg_days_between_visits: 18 + i * 4,
      last_visit_date: c.last_visit_at?.slice(0, 10) ?? null, predicted_next_visit: ymd(addDays(today, 3 + i * 2)), ltv: c.total_spent,
      preferred_day_of_week: (i % 6) + 1, preferred_time: ["morning", "afternoon", "evening"][i % 3], preferred_professional_id: professionals[i % 4].id,
      total_appointments: c.total_visits, total_spent: c.total_spent, updated_at: now.toISOString(),
    })),
    admin_notifications: upcoming.map((a, i) => ({
      id: uid(380 + i), salon_id: SALON_ID, appointment_id: a.id, type: i === 3 ? "cancelled_appointment" : "new_appointment",
      title: i === 3 ? "Agendamento cancelado" : "Novo agendamento", message: `${a.client_name} - ${svcName(a.service_id)} às ${a.start_time}`,
      client_name: a.client_name, client_phone: a.client_phone, appointment_date: `${a.date}T${a.start_time}:00`, read: i > 1,
      metadata: { service_name: svcName(a.service_id) }, created_at: new Date(now.getTime() - (i + 1) * 3600_000).toISOString(),
    })),
    loyalty_settings: [{ id: uid(390), salon_id: SALON_ID, points_per_real: 1, points_per_referral: 50, points_per_review: 10, birthday_multiplier: 2, is_active: true }],
    loyalty_tiers: tiers,
    loyalty_points: loyaltyPoints,
    loyalty_transactions: loyaltyTransactions,
    loyalty_redemptions: loyaltyRedemptions,
    loyalty_rewards: [],
    referral_settings: [{ id: uid(590), salon_id: SALON_ID, is_active: true, referrer_reward_type: "points", referrer_reward_value: 50, referee_reward_type: "discount", referee_reward_value: 10, min_purchase_for_reward: 50 }],
    referral_codes: clients.slice(0, 4).map((c, i) => ({ id: uid(600 + i), salon_id: SALON_ID, client_id: c.id, code: `BELLA${String(c.name).split(" ")[0].normalize("NFD").replace(/[^a-zA-Z]/g, "").toUpperCase()}`, uses_count: 3 - (i % 3), is_active: true, created_at: addDays(today, -60).toISOString() })),
    referrals: [[0, 10, "rewarded"], [0, 12, "rewarded"], [0, 21, "pending"], [1, 14, "rewarded"], [2, 22, "pending"], [3, 23, "completed"]].map(([r, e, status], i) => ({
      id: uid(620 + i), salon_id: SALON_ID, referrer_id: clients[r as number].id, referee_id: clients[e as number].id, code_id: uid(600 + (r as number)), status,
      referrer_rewarded_at: status === "rewarded" ? addDays(today, -10).toISOString() : null, referee_rewarded_at: null, created_at: addDays(today, -40 + i * 6).toISOString(),
    })),
    waitlist: [[5, 3, 2, "waiting"], [8, 0, 0, "waiting"], [11, 4, 3, "notified"], [16, 1, 1, "waiting"]].map(([c, s, p, status], i) => ({
      id: uid(700 + i), salon_id: SALON_ID, client_id: clients[c as number].id, client_name: clients[c as number].name, client_phone: clients[c as number].phone,
      service_id: services[s as number].id, professional_id: professionals[p as number].id, preferred_date: ymd(addDays(today, 1 + i)), preferred_time: null,
      notes: i === 0 ? "Pode ser qualquer horário à tarde." : null, status, priority: 4 - i, created_at: addDays(today, -i - 1).toISOString(),
    })),
    goals: [["revenue", "Faturamento do mês", 15000], ["appointments", "Atendimentos do mês", 180], ["new_clients", "Novos clientes", 10]].map(([type, name, target_value], i) => ({
      id: uid(750 + i), salon_id: SALON_ID, type, name, target_value, current_value: 0, period: "monthly", start_date: ymd(monthStart), end_date: ymd(monthEnd),
      professional_id: null, status: "active", completed_at: null, created_at: monthStart.toISOString(),
    })),
    broadcast_templates: [
      { id: uid(780), salon_id: SALON_ID, name: "Lembrete de retorno", content: "Olá {nome}! Sentimos sua falta no Studio Bella. Que tal agendar seu horário?", created_at: base.created_at },
      { id: uid(781), salon_id: SALON_ID, name: "Promoção da semana", content: "Esta semana: hidratação com 15% de desconto. Agende pelo link!", created_at: base.created_at },
    ],
    whatsapp_instances: [], // WhatsApp desconectado na demo
    user_training_progress: [],
  };
}
