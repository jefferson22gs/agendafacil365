import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSalon, whatsappDb } from "@/pages/admin/whatsapp/api";
import { GuidedFlowSimulator } from "./GuidedFlowSimulator";

export type RenderMode = "poll" | "buttons" | "hybrid" | "numbered" | "native";
interface Settings { guided_flow_enabled: boolean; guided_render_mode: RenderMode; guided_welcome_message: string; guided_confirmation_message: string; guided_info_text: string; guided_handoff_hours: number }
const COLUMNS = "guided_flow_enabled,guided_render_mode,guided_welcome_message,guided_confirmation_message,guided_info_text,guided_handoff_hours";
// Iguais aos defaults de MIGRATION_TYPEBOT_EVOLUTION_237.sql.
const DEFAULTS: Settings = { guided_flow_enabled: false, guided_render_mode: "poll", guided_welcome_message: "", guided_confirmation_message: "", guided_info_text: "", guided_handoff_hours: 2 };
const MODES: { value: RenderMode; label: string; hint: string }[] = [
  { value: "poll", label: "Opções clicáveis (recomendado)", hint: "Cada etapa chega como uma enquete de toque único, com até 9 opções (1️⃣ 2️⃣ 3️⃣…). É o formato que chega em qualquer celular (Android, iPhone e WhatsApp Web). O cliente também pode responder com o número." },
  { value: "buttons", label: "Botões (até 3 por mensagem)", hint: "Atenção: com a conexão atual (WhatsApp Web), o WhatsApp pode não mostrar estes botões ao cliente. Só botões, até 3 por mensagem. Mais opções aparecem em ➡️ Ver mais e os horários são filtrados por turno (☀️ Manhã, 🌤️ Tarde, 🌙 Noite). O cliente não precisa digitar números." },
  { value: "hybrid", label: "Híbrido inteligente", hint: "Botões e listas da Evolution 2.3.7 com os números no texto. Se o aparelho não mostrar o botão, o cliente responde com o número." },
  { value: "numbered", label: "Apenas menus numerados", hint: "Só texto numerado (1, 2, 3…). 100% compatível com iOS e Android." },
  { value: "native", label: "Botões e listas nativas", hint: "Botões e listas sem os números no texto. O fallback numerado continua automático se a API recusar." },
];

/** Aba "Fluxo de agendamento (Typebot / botões)": configuração + simulador. Sem a migração aplicada, avisa e não quebra. */
export function GuidedFlowCard() {
  const { data: salon, error: salonError } = useWhatsAppSalon();
  const salonId = salon?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [s, setS] = useState<Settings>(DEFAULTS);

  const query = useQuery({
    queryKey: ["whatsapp-guided-flow", salonId],
    enabled: !!salonId,
    queryFn: async () => {
      const { data, error } = await whatsappDb.from("whatsapp_automation_settings").select(COLUMNS).eq("salon_id", salonId!).maybeSingle();
      // 42703 = colunas ainda não existem (migração pendente).
      if (error) { if (error.code === "42703") return { settings: DEFAULTS, migrated: false }; throw error; }
      const row = (data ?? {}) as Partial<Record<keyof Settings, unknown>>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      return { migrated: true, settings: {
        guided_flow_enabled: row.guided_flow_enabled === true, guided_render_mode: (["poll", "buttons", "hybrid", "numbered", "native"].includes(String(row.guided_render_mode)) ? row.guided_render_mode : "poll") as RenderMode,
        guided_welcome_message: str(row.guided_welcome_message), guided_confirmation_message: str(row.guided_confirmation_message), guided_info_text: str(row.guided_info_text),
        guided_handoff_hours: Number(row.guided_handoff_hours) || 2,
      } };
    },
  });
  useEffect(() => { if (query.data) setS(query.data.settings); }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const nul = (v: string) => (v.trim() ? v.trim() : null);
      const { error } = await whatsappDb.from("whatsapp_automation_settings").upsert({
        salon_id: salonId, guided_flow_enabled: s.guided_flow_enabled, guided_render_mode: s.guided_render_mode, guided_welcome_message: nul(s.guided_welcome_message),
        guided_confirmation_message: nul(s.guided_confirmation_message), guided_info_text: nul(s.guided_info_text), guided_handoff_hours: s.guided_handoff_hours, updated_at: new Date().toISOString(),
      }, { onConflict: "salon_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Fluxo de agendamento salvo." }); void queryClient.invalidateQueries({ queryKey: ["whatsapp-guided-flow", salonId] }); },
    onError: () => toast({ title: "Não foi possível salvar. Tente novamente.", variant: "destructive" }),
  });
  const validHours = Number.isInteger(s.guided_handoff_hours) && s.guided_handoff_hours >= 1 && s.guided_handoff_hours <= 72;

  if (salonError) return null;
  if (!salonId || query.isLoading) return <Card><CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status"><Loader2 className="animate-spin" aria-hidden />Carregando fluxo de agendamento…</CardContent></Card>;
  if (query.isError) return <Card><CardContent className="p-6 text-sm text-destructive" role="alert">Não foi possível carregar o fluxo de agendamento.</CardContent></Card>;
  const migrated = query.data?.migrated !== false;
  const mode = MODES.find(m => m.value === s.guided_render_mode) ?? MODES[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card data-tour="guided-flow-card">
        <CardHeader>
          <CardTitle>Fluxo de agendamento (Typebot / botões)</CardTitle>
          <CardDescription>Menu principal, agendamento passo a passo, remarcação e cancelamento pelo próprio cliente, com botões, listas e atalhos numéricos na Evolution API 2.3.7.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!migrated && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">Execute <code>MIGRATION_TYPEBOT_EVOLUTION_237.sql</code> no Supabase para ativar esta aba. Até lá, o atendente clássico continua respondendo.</p>}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><Label htmlFor="guided-enabled" className="font-medium">Fluxo guiado por botões/opções</Label><p id="guided-enabled-hint" className="text-sm text-muted-foreground">Ligado, toda conversa começa no menu principal. Desligado, o atendente por IA responde como antes.</p></div>
            <Switch id="guided-enabled" aria-describedby="guided-enabled-hint" checked={s.guided_flow_enabled} disabled={!migrated} onCheckedChange={v => setS(p => ({ ...p, guided_flow_enabled: v }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guided-mode">Modo de renderização na Evolution API 2.3.7</Label>
            <Select value={s.guided_render_mode} onValueChange={v => setS(p => ({ ...p, guided_render_mode: v as RenderMode }))} disabled={!migrated}>
              <SelectTrigger id="guided-mode" className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{mode.hint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guided-welcome">Mensagem de boas-vindas</Label>
            <Textarea id="guided-welcome" rows={2} maxLength={1000} disabled={!migrated} placeholder="Olá, {primeiro_nome}! 👋 Bem-vindo(a) ao {salao}." value={s.guided_welcome_message} onChange={e => setS(p => ({ ...p, guided_welcome_message: e.target.value }))} />
            <p className="text-xs text-muted-foreground">Variáveis: {"{nome}"}, {"{primeiro_nome}"}, {"{salao}"}. Vazio usa o texto padrão.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guided-confirmation">Texto de confirmação do agendamento</Label>
            <Textarea id="guided-confirmation" rows={2} maxLength={1000} disabled={!migrated} placeholder="✅ Agendamento registrado! Te esperamos, {primeiro_nome}." value={s.guided_confirmation_message} onChange={e => setS(p => ({ ...p, guided_confirmation_message: e.target.value }))} />
            <p className="text-xs text-muted-foreground">O resumo (serviço, profissional, data, valor) e o link do app são acrescentados automaticamente.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guided-info">Endereço e horário de funcionamento (opção 4 do menu)</Label>
            <Textarea id="guided-info" rows={3} maxLength={1500} disabled={!migrated} placeholder="Vazio: usa o endereço e os horários cadastrados no estabelecimento." value={s.guided_info_text} onChange={e => setS(p => ({ ...p, guided_info_text: e.target.value }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="guided-handoff">Pausa quando o cliente pede atendente (horas)</Label>
            <Input id="guided-handoff" type="number" inputMode="numeric" min={1} max={72} className="min-h-11 w-24" aria-invalid={!validHours} disabled={!migrated}
              value={Number.isFinite(s.guided_handoff_hours) ? s.guided_handoff_hours : ""} onChange={e => setS(p => ({ ...p, guided_handoff_hours: e.target.valueAsNumber }))} />
          </div>
          <div className="flex justify-end">
            <Button variant="brand" className="min-h-11" data-tour="guided-flow-save" disabled={save.isPending || !migrated} onClick={() => validHours ? save.mutate() : toast({ title: "A pausa deve ficar entre 1 e 72 horas.", variant: "destructive" })}>
              {save.isPending && <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />}Salvar fluxo
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* O simulador usa o que está salvo no banco (preview no servidor). */}
      <GuidedFlowSimulator salonId={salonId} enabled={migrated && query.data?.settings.guided_flow_enabled === true} dirty={JSON.stringify(s) !== JSON.stringify(query.data?.settings)} />
    </div>
  );
}

export default GuidedFlowCard;
