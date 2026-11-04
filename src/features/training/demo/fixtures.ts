export type DemoRow = Record<string, unknown>;
export const USER_ID = "00000000-0000-4000-8000-000000000001";
export const SALON_ID = "00000000-0000-4000-8000-000000000010";
const professionalId = "00000000-0000-4000-8000-000000000020";
const serviceId = "00000000-0000-4000-8000-000000000030";
const clientId = "00000000-0000-4000-8000-000000000040";
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const days = Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => [d, { isOpen: d !== "sunday", open: "09:00", close: "18:00" }]));
const base = { salon_id: SALON_ID, created_at: now.toISOString(), updated_at: now.toISOString(), is_active: true };
const services = [
  { ...base, id: serviceId, name: "Corte Feminino", description: "Corte com acabamento", price: 60, duration_minutes: 45, icon: "✂️" },
  { ...base, id: "00000000-0000-4000-8000-000000000031", name: "Escova", description: "Escova modeladora", price: 45, duration_minutes: 30, icon: "💇" },
  { ...base, id: "00000000-0000-4000-8000-000000000032", name: "Manicure", description: "Cuidados com as unhas", price: 30, duration_minutes: 30, icon: "💅" },
];
const professionals = [
  { ...base, id: professionalId, user_id: USER_ID, name: "Ana Demo", phone: "", email: "", specialty: "Cabelos", commission_percentage: 30, commission_rate: 30, working_days: [1, 2, 3, 4, 5, 6], working_hours: days, slug: "ana-demo", avatar_url: null },
  { ...base, id: "00000000-0000-4000-8000-000000000021", name: "Carlos Demo", phone: "", email: "", specialty: "Barbearia", commission_percentage: 25, commission_rate: 25, working_days: [1, 2, 3, 4, 5, 6], slug: "carlos-demo", avatar_url: null },
];
const clients = [
  { ...base, id: clientId, name: "Mariana Demo", phone: "", email: "mariana@example.invalid", birth_date: "1995-06-10", notes: "Dados fictícios", loyalty_points: 40 },
  { ...base, id: "00000000-0000-4000-8000-000000000041", name: "João Exemplo", phone: "", email: "joao@example.invalid", birth_date: null, notes: "", loyalty_points: 0 },
];
export const fixtures: Record<string, DemoRow[]> = {
  profiles: [{ id: USER_ID, user_id: USER_ID, full_name: "Administrador Demo", phone: "", avatar_url: null }],
  user_roles: [{ id: USER_ID, user_id: USER_ID, role: "admin", salon_id: SALON_ID }],
  salons: [{ ...base, id: SALON_ID, owner_id: USER_ID, name: "Studio Beleza Demo", slug: "studio-beleza-demo", description: "Ambiente de demonstração. Nenhum dado real.", phone: "", whatsapp: "", email: "studio@example.invalid", address: "Rua Exemplo, 100", city: "Cidade Demo", state: "SP", zip_code: "00000000", logo_url: null, primary_color: "#2563EB", public_booking_enabled: true, working_hours: days, working_days: [1, 2, 3, 4, 5, 6], opening_time: "09:00", closing_time: "18:00", lunch_break_config: { enabled: false }, cnpj: "", business_name: "Studio Beleza Demo", pix_key: "" }],
  services, professionals, clients,
  professional_services: professionals.flatMap((p) => services.map((s) => ({ professional_id: p.id, service_id: s.id, services: s }))),
  appointments: [
    { ...base, id: "00000000-0000-4000-8000-000000000050", client_id: clientId, client_name: "Mariana Demo", client_phone: "", service_id: serviceId, professional_id: professionalId, date, start_time: "10:00", end_time: "10:45", total_price: 60, final_price: 60, original_price: 60, discount_amount: 0, status: "confirmed", notes: "Demonstração", services: services[0], professionals: professionals[0], clients: clients[0] },
    { ...base, id: "00000000-0000-4000-8000-000000000051", client_id: clientId, client_name: "Mariana Demo", client_phone: "", service_id: serviceId, professional_id: professionalId, date, start_time: "09:00", end_time: "09:45", total_price: 60, final_price: 60, original_price: 60, discount_amount: 0, status: "completed", notes: "Demonstração", services: services[0], professionals: professionals[0], clients: clients[0] },
  ],
  subscriptions: [{ ...base, id: SALON_ID, user_id: USER_ID, plan: "premium", plan_type: "premium", status: "active", amount: 39.9, price: 39.9, current_period_end: "2099-12-31T00:00:00Z", expires_at: "2099-12-31T00:00:00Z", end_date: "2099-12-31T00:00:00Z", trial_ends_at: "2099-12-31T00:00:00Z" }],
  products: [{ ...base, id: "00000000-0000-4000-8000-000000000060", name: "Shampoo Demo", description: "Produto fictício", price: 35, stock: 12, image_url: null, category: "Cabelos" }],
  coupons: [{ ...base, id: "00000000-0000-4000-8000-000000000070", code: "DEMO10", discount_type: "percentage", discount_value: 10, value: 10, min_purchase: 0, is_active: true, valid_until: "2099-12-31", usage_count: 0, usage_limit: 20 }],
  whatsapp_instances: [], broadcasts: [], broadcast_templates: [], scheduled_posts: [], chatbot_configs: [], chatbot_conversations: [], chatbot_knowledge_base: [], user_training_progress: [], salon_groups: [], service_packages: [], reviews: [], salon_reviews: [], before_after_photos: [], admin_notifications: [], ai_provider_keys: [], notifications: [],
};
