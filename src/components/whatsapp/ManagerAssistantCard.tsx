import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppSalon, whatsappCall } from "@/pages/admin/whatsapp/api";
import { ManagerAssistantChat } from "./ManagerAssistantChat";

export interface ManagerSettings {
  manager_assistant_enabled: boolean;
  manager_access_level: "basic" | "intermediate" | "advanced";
  authorized_manager_phones: string[];
}
const LEVELS = [
  { id: "basic", name: "1. Básico", description: "Leitura e análises", badges: ["Ler dados", "Fazer análises"] },
  { id: "intermediate", name: "2. Intermediário", description: "Ações no sistema", badges: ["Criar lançamentos", "Dar baixa", "Gerir agenda e retornos"] },
  { id: "advanced", name: "3. Avançado", description: "Arquivos, fotos, áudios e acesso total", badges: ["Arquivos", "Fotos de notas", "Áudios de voz", "Acesso ao sistema"] },
] as const;

export function ManagerAssistantCard() {
  const { data: salon, error: salonError } = useWhatsAppSalon();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ManagerSettings | null>(null);
  const [phones, setPhones] = useState("");
  const query = useQuery({
    queryKey: ["manager-assistant", salon?.id], enabled: !!salon,
    queryFn: async () => await whatsappCall("manager-assistant", { action: "settings", salonId: salon!.id }) as { settings: ManagerSettings; profilePhone: string | null },
  });
  useEffect(() => {
    if (query.data) { setSettings(query.data.settings); setPhones(query.data.settings.authorized_manager_phones.join("\n")); }
  }, [query.data]);
  const entered = phones.split(/[\n;,]+/).map(s => s.trim()).filter(Boolean);
  const valid = entered.length <= 20 && entered.every(p => /^\+55[1-9]\d{9,10}$/.test(p));
  const dirty = !!settings && !!query.data && (JSON.stringify(settings) !== JSON.stringify(query.data.settings) || phones !== query.data.settings.authorized_manager_phones.join("\n"));
  const save = useMutation({
    mutationFn: async () => {
      if (!settings || !salon || !valid) throw new Error("Use números do Brasil no formato +55 DDD número; máximo de 20 gestores.");
      return whatsappCall("manager-assistant", { action: "save_settings", salonId: salon.id, settings: { ...settings, authorized_manager_phones: [...new Set(entered)] } });
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["manager-assistant", salon?.id] }); },
  });
  if (salonError || query.error) return <p role="alert">{(salonError || query.error)?.message} <Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></p>;
  if (!salon || !settings) return <p role="status">Carregando assistente do gestor…</p>;
  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle>AgendaFácil 365 Pro IA</CardTitle><CardDescription>Seu assistente executivo no WhatsApp. Clientes continuam no atendimento de agendamento; somente gestores autorizados acessam a gestão.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3"><Switch id="manager-enabled" checked={settings.manager_assistant_enabled} disabled={save.isPending} onCheckedChange={v => setSettings({ ...settings, manager_assistant_enabled: v })} /><Label htmlFor="manager-enabled">Ativar Assistente do Gestor (IA)</Label></div>
        <fieldset disabled={save.isPending}><legend className="mb-3 font-medium">Nível de acesso do assistente no WhatsApp</legend>
          <div className="grid gap-3 lg:grid-cols-3">{LEVELS.map(level => <label key={level.id} className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-primary ${settings.manager_access_level === level.id ? "border-primary bg-primary/5" : "border-border"}`}>
            <span className="flex items-center gap-2"><input type="radio" name="manager-level" value={level.id} checked={settings.manager_access_level === level.id} onChange={() => setSettings({ ...settings, manager_access_level: level.id })} className="h-4 w-4 accent-primary" /><span className="font-semibold">{level.name}</span></span>
            <span className="text-sm text-muted-foreground">{level.description}</span>
            <span className="flex flex-wrap gap-2">{level.badges.map(b => <Badge key={b} variant="secondary">{b}</Badge>)}</span>
            {level.id === "advanced" && <span className="text-sm font-medium text-success">✓ Sempre com a sua confirmação</span>}
          </label>)}</div>
        </fieldset>
        <div className="space-y-2"><Label htmlFor="manager-phones">Números de gestores autorizados</Label>
          <Textarea id="manager-phones" value={phones} onChange={e => setPhones(e.target.value)} disabled={save.isPending} placeholder="+5511999999999" aria-describedby="manager-phones-help" aria-invalid={!valid} rows={3} maxLength={500} />
          <p id="manager-phones-help" className="text-sm text-muted-foreground">Um número por linha, no formato +55 DDD número. Máximo de 20. Autorize somente pessoas que podem consultar os dados financeiros e operar este salão.</p>
          <p className="text-sm">Telefone do perfil: <strong>{query.data?.profilePhone || "Não cadastrado"}</strong>. O comando #gestor não concede acesso a números desconhecidos.</p>
          <p className="text-sm text-muted-foreground">Envie de um telefone autorizado para o WhatsApp conectado do salão. Não envie do próprio número conectado.</p>
        </div>
        <p className="rounded-lg border p-3 text-sm">Toda alteração exige resumo e confirmação. A autorização expira após 10 minutos; permissões são verificadas novamente ao confirmar. Áudio e documentos são processados pelo provedor de IA configurado.</p>
        <div className="flex flex-wrap items-center gap-3"><Button disabled={!valid || !dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar configurações"}</Button>
          {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
          {save.isSuccess && !dirty && <p role="status" className="text-sm">Configurações salvas.</p>}
        </div>
      </CardContent>
    </Card>
    <ManagerAssistantChat key={salon.id} salonId={salon.id} enabled={settings.manager_assistant_enabled && !dirty && !save.isPending} advanced={settings.manager_access_level === "advanced"} />
    {dirty && <p role="status" className="text-sm text-muted-foreground">Salve as configurações para usar o chat com as novas permissões.</p>}
  </div>;
}
