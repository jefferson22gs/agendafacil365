import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSalon, whatsappDb } from "@/pages/admin/whatsapp/api";

type Flag = "reminders_enabled" | "review_enabled" | "birthday_enabled" | "birthday_coupon_enabled" | "interactive_enabled" | "chatbot_booking_enabled";
type Settings = Record<Flag, boolean> & { reminder_minutes: number[]; birthday_coupon_validity_days: number };
const COLUMNS = "reminders_enabled,reminder_minutes,review_enabled,birthday_enabled,birthday_coupon_enabled,birthday_coupon_validity_days,interactive_enabled,chatbot_booking_enabled";

// Iguais aos defaults do banco (migração 20261106004001); linha inexistente = estes valores.
const DEFAULTS: Settings = {
  reminders_enabled: false, reminder_minutes: [1440, 120, 30, 15], review_enabled: false, birthday_enabled: false,
  birthday_coupon_enabled: false, birthday_coupon_validity_days: 30, interactive_enabled: true, chatbot_booking_enabled: false,
};
const MAX_REMINDERS = 5; // constraint do banco
// Subconjunto dos valores aceitos pela constraint reminder_minutes.
const REMINDER_OPTIONS = [
  { minutes: 2880, label: "2 dias antes" }, { minutes: 1440, label: "1 dia antes" }, { minutes: 360, label: "6 horas antes" },
  { minutes: 120, label: "2 horas antes" }, { minutes: 60, label: "1 hora antes" }, { minutes: 30, label: "30 minutos antes" },
  { minutes: 15, label: "15 minutos antes" },
];

function Toggle({ id, label, hint, checked, onChange, tour }: { id: Flag; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; tour?: string }) {
  return (
    <div className="flex items-start justify-between gap-4" data-tour={tour}>
      <div className="min-w-0"><Label htmlFor={`wa-auto-${id}`} className="font-medium">{label}</Label><p id={`wa-auto-${id}-hint`} className="text-sm text-muted-foreground">{hint}</p></div>
      <Switch id={`wa-auto-${id}`} aria-describedby={`wa-auto-${id}-hint`} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Automações do atendente WhatsApp (aba Chatbot). Salão via dono logado; RLS "Owner automation preferences". */
export function AutomationSettingsCard() {
  const { data: salon, error: salonError } = useWhatsAppSalon();
  const salonId = salon?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [s, setS] = useState<Settings>(DEFAULTS);

  const query = useQuery({
    queryKey: ["whatsapp-automation-card", salonId],
    enabled: !!salonId,
    queryFn: async () => {
      const [cfg, sal] = await Promise.all([
        whatsappDb.from("whatsapp_automation_settings").select(COLUMNS).eq("salon_id", salonId!).maybeSingle(),
        whatsappDb.from("salons").select("birthday_discount_percent").eq("id", salonId!).maybeSingle(),
      ]);
      if (cfg.error) throw cfg.error;
      return { settings: { ...DEFAULTS, ...(cfg.data ?? {}) } as Settings, percent: (sal.data?.birthday_discount_percent as number | null) ?? null };
    },
  });
  useEffect(() => { if (query.data) setS(query.data.settings); }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await whatsappDb.from("whatsapp_automation_settings")
        .upsert({ salon_id: salonId, ...s, updated_at: new Date().toISOString() }, { onConflict: "salon_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Automações salvas." }); void queryClient.invalidateQueries({ queryKey: ["whatsapp-automation-card", salonId] }); },
    onError: () => toast({ title: "Não foi possível salvar. Tente novamente.", variant: "destructive" }),
  });

  const set = (k: Flag) => (v: boolean) => setS(p => ({ ...p, [k]: v }));
  const toggleReminder = (m: number) => setS(p => ({
    ...p,
    reminder_minutes: p.reminder_minutes.includes(m) ? p.reminder_minutes.filter(x => x !== m) : [...p.reminder_minutes, m].sort((a, b) => b - a),
  }));
  const validDays = Number.isInteger(s.birthday_coupon_validity_days) && s.birthday_coupon_validity_days >= 1 && s.birthday_coupon_validity_days <= 365;

  const submit = () => {
    if (s.reminders_enabled && s.reminder_minutes.length === 0) return toast({ title: "Escolha ao menos um horário de lembrete.", variant: "destructive" });
    if (!validDays) return toast({ title: "Validade do cupom deve ficar entre 1 e 365 dias.", variant: "destructive" });
    save.mutate();
  };

  if (salonError) return null; // Sem salão: o restante da página já orienta o cadastro.
  if (!salonId || query.isLoading) return <Card><CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status"><Loader2 className="animate-spin" aria-hidden />Carregando automações…</CardContent></Card>;
  if (query.isError) return <Card><CardContent className="p-6 text-sm text-destructive" role="alert">Não foi possível carregar as automações.</CardContent></Card>;

  const percent = query.data?.percent;
  return (
    <Card data-tour="automation-card">
      <CardHeader>
        <CardTitle>Automações do atendente</CardTitle>
        <CardDescription>Mensagens que o WhatsApp do salão envia sozinho. Só valem com o WhatsApp conectado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3" data-tour="automation-reminders">
          <Toggle id="reminders_enabled" label="Lembrete antes do horário" hint="Inclui serviço, profissional e endereço. Não é enviado se o horário for cancelado ou remarcado." checked={s.reminders_enabled} onChange={set("reminders_enabled")} />
          {s.reminders_enabled && (
            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Quando enviar (até {MAX_REMINDERS})</legend>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map(o => {
                  const on = s.reminder_minutes.includes(o.minutes);
                  return <Button key={o.minutes} type="button" size="sm" className="min-h-11" variant={on ? "default" : "outline"} aria-pressed={on}
                    disabled={!on && s.reminder_minutes.length >= MAX_REMINDERS} onClick={() => toggleReminder(o.minutes)}>{o.label}</Button>;
                })}
              </div>
            </fieldset>
          )}
        </div>
        <Toggle id="review_enabled" tour="automation-review" label="Pedir avaliação após o atendimento" hint="Envia um pedido de avaliação depois que o atendimento é concluído." checked={s.review_enabled} onChange={set("review_enabled")} />
        <div className="space-y-3" data-tour="automation-birthday">
          <Toggle id="birthday_enabled" label="Mensagem de aniversário" hint="Enviada às 9h (horário do salão), uma vez por ano. Clientes que pediram para sair não recebem." checked={s.birthday_enabled} onChange={set("birthday_enabled")} />
          {s.birthday_enabled && (
            <div className="space-y-3 rounded-lg border p-4">
              <Toggle id="birthday_coupon_enabled" label="Incluir cupom de presente" hint={percent ? `Cupom individual de uso único com ${percent}% de desconto (definido nas configurações do salão).` : "Defina o desconto de aniversário nas configurações do salão para ativar o cupom."} checked={s.birthday_coupon_enabled} onChange={set("birthday_coupon_enabled")} />
              {s.birthday_coupon_enabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="wa-auto-coupon-days">Validade do cupom (dias)</Label>
                  <Input id="wa-auto-coupon-days" type="number" inputMode="numeric" min={1} max={365} className="min-h-11 w-24" aria-invalid={!validDays}
                    value={Number.isFinite(s.birthday_coupon_validity_days) ? s.birthday_coupon_validity_days : ""}
                    onChange={e => setS(p => ({ ...p, birthday_coupon_validity_days: e.target.valueAsNumber }))} />
                </div>
              )}
            </div>
          )}
        </div>
        <Toggle id="interactive_enabled" tour="automation-interactive" label="Botões e listas nas respostas" hint="O atendente pode oferecer opções clicáveis (serviços, horários) em vez de só texto." checked={s.interactive_enabled} onChange={set("interactive_enabled")} />
        <Toggle id="chatbot_booking_enabled" tour="automation-booking" label="Atendente pode criar agendamentos" hint="O cliente precisa confirmar. O pedido fica pendente até o salão confirmar." checked={s.chatbot_booking_enabled} onChange={set("chatbot_booking_enabled")} />
        <div className="flex justify-end">
          <Button variant="brand" className="min-h-11" data-tour="automation-save" disabled={save.isPending} onClick={submit}>{save.isPending && <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />}Salvar automações</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AutomationSettingsCard;
