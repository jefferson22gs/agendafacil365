import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Flags = "confirmation_enabled" | "reminders_enabled" | "cancellation_enabled" | "reschedule_enabled" | "birthday_enabled" | "chatbot_booking_enabled";
type Settings = Record<Flags, boolean> & { reminder_minutes: number[] };

const DEFAULTS: Settings = {
  confirmation_enabled: false, reminders_enabled: false, cancellation_enabled: false,
  reschedule_enabled: false, birthday_enabled: false, chatbot_booking_enabled: false, reminder_minutes: [1440, 120],
};

const TOGGLES: { key: Flags; label: string; hint: string }[] = [
  { key: "confirmation_enabled", label: "Confirmação de agendamento", hint: "Envia os dados do horário quando o agendamento é criado ou confirmado." },
  { key: "reminders_enabled", label: "Lembrete antes do horário", hint: "Não é enviado se o agendamento for cancelado ou alterado." },
  { key: "cancellation_enabled", label: "Aviso de cancelamento", hint: "Avisa o cliente quando o horário é cancelado." },
  { key: "reschedule_enabled", label: "Aviso de remarcação", hint: "Envia o novo dia e horário quando o agendamento muda." },
  { key: "birthday_enabled", label: "Mensagem de aniversário", hint: "Parabéns no dia do aniversário do cliente." },
  { key: "chatbot_booking_enabled", label: "Chatbot pode criar agendamentos", hint: "O cliente precisa responder CONFIRMAR. O pedido fica pendente até o estabelecimento confirmar." },
];

// Mesmos valores aceitos pela constraint do banco.
const REMINDER_OPTIONS = [
  { minutes: 2880, label: "2 dias antes" }, { minutes: 1440, label: "1 dia antes" }, { minutes: 360, label: "6 horas antes" },
  { minutes: 120, label: "2 horas antes" }, { minutes: 60, label: "1 hora antes" }, { minutes: 30, label: "30 minutos antes" },
];

export function AutomationSettings({ salonId }: { salonId: string }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("whatsapp_automation_settings")
        .select("*").eq("salon_id", salonId).maybeSingle();
      if (cancelled) return;
      if (error) toast({ title: "Não foi possível carregar as automações.", variant: "destructive" });
      else if (data) setSettings({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [salonId, toast]);

  const toggleReminder = (m: number) => setSettings(s => {
    const has = s.reminder_minutes.includes(m);
    const next = has ? s.reminder_minutes.filter(x => x !== m) : [...s.reminder_minutes, m].sort((a, b) => b - a);
    return { ...s, reminder_minutes: next.slice(0, 5) };
  });

  const save = async () => {
    if (settings.reminders_enabled && settings.reminder_minutes.length === 0) {
      toast({ title: "Escolha ao menos um horário de lembrete.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("whatsapp_automation_settings")
      .upsert({ salon_id: salonId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "salon_id" });
    setSaving(false);
    toast(error ? { title: "Não foi possível salvar. Tente novamente.", variant: "destructive" } : { title: "Mensagens automáticas salvas." });
  };

  if (loading) return <Card><CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="animate-spin" aria-hidden />Carregando mensagens automáticas…</CardContent></Card>;

  return (
    <Card data-tour="whatsapp-automations">
      <CardHeader>
        <CardTitle>Mensagens automáticas</CardTitle>
        <CardDescription>Escolha o que o sistema envia sozinho pelo WhatsApp do estabelecimento. Tudo começa desligado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {TOGGLES.map(t => (
          <div key={t.key} className="flex items-start justify-between gap-4">
            <div><Label htmlFor={t.key} className="font-medium">{t.label}</Label><p className="text-sm text-muted-foreground">{t.hint}</p></div>
            <Switch id={t.key} checked={settings[t.key]} onCheckedChange={v => setSettings(s => ({ ...s, [t.key]: v }))} />
          </div>
        ))}
        {settings.reminders_enabled && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-3">Quando enviar o lembrete</p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map(o => (
                <Button key={o.minutes} type="button" size="sm" variant={settings.reminder_minutes.includes(o.minutes) ? "default" : "outline"} aria-pressed={settings.reminder_minutes.includes(o.minutes)} onClick={() => toggleReminder(o.minutes)}>{o.label}</Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end"><Button variant="brand" disabled={saving} onClick={() => void save()}>{saving && <Loader2 className="animate-spin mr-2" size={16} />}Salvar</Button></div>
      </CardContent>
    </Card>
  );
}
