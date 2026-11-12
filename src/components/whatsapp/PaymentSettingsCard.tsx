import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppSalon, whatsappDb } from "@/pages/admin/whatsapp/api";

type Provider = "pix_manual" | "mercadopago" | "asaas" | "pagbank" | "infinitepay";
type Method = "pix" | "card";
interface Settings { whatsapp_enabled: boolean; provider: Provider; methods: Method[]; pay_at_salon: boolean; sandbox: boolean; infinitepay_handle: string | null; credential_hint: string | null; credential_ok_at: string | null }
const DEFAULTS: Settings = { whatsapp_enabled: false, provider: "pix_manual", methods: ["pix"], pay_at_salon: true, sandbox: false, infinitepay_handle: null, credential_hint: null, credential_ok_at: null };

/** Tutorial de cada provedor: onde pegar a chave, em linguagem de quem não é técnico. */
export const PROVIDERS: { id: Provider; name: string; tagline: string; auto: boolean; pix: string; card: boolean; keyLabel?: string; keyPlaceholder?: string; link?: string; steps: string[]; tip?: string }[] = [
  { id: "pix_manual", name: "Pix pela chave do salão", tagline: "Sem cadastro em provedor. O cliente recebe QR Code e copia e cola; a equipe confere o comprovante.", auto: false, pix: "QR Code + copia e cola", card: false,
    steps: ["Abra Configurações > Dados do salão e preencha a Chave PIX.", "Volte aqui, ligue Cobrar pelo WhatsApp e salve.", "Quando o cliente enviar o comprovante, ele aparece em WhatsApp > Conversas > Comprovantes para você conferir."],
    tip: "Simples, mas a confirmação é manual. Para confirmar sozinho, use um dos provedores abaixo." },
  { id: "mercadopago", name: "Mercado Pago", tagline: "Pix copia e cola direto no WhatsApp e cartão em página segura. Confirma sozinho.", auto: true, pix: "Copia e cola no chat", card: true,
    keyLabel: "Access Token de produção", keyPlaceholder: "APP_USR-…", link: "https://www.mercadopago.com.br/developers/panel/app",
    steps: ["Entre em mercadopago.com.br/developers/panel/app com a conta que recebe os pagamentos.", "Clique em Criar aplicação, dê um nome (ex.: Agenda do Salão) e escolha Pagamentos online.", "No menu da aplicação, abra Credenciais de produção. Se pedir, informe o ramo e o site e clique em Ativar.", "Copie o Access Token (começa com APP_USR-) e cole abaixo.", "No app do Mercado Pago, confira se você tem uma chave Pix cadastrada (Seu perfil > Suas chaves Pix)."],
    tip: "Nunca use a Public Key: precisa ser o Access Token." },
  { id: "asaas", name: "Asaas", tagline: "Pix e cartão em página segura do Asaas, sem pedir CPF no chat. Confirma sozinho.", auto: true, pix: "Página segura", card: true,
    keyLabel: "Chave de API", keyPlaceholder: "$aact_prod_…", link: "https://www.asaas.com/customerApiAccessToken/index",
    steps: ["Entre no Asaas pelo computador (no app não dá) com um usuário administrador.", "Abra Integrações (menu do seu nome > Integrações) ou o link ao lado.", "Clique em Gerar chave de API, dê um nome e confirme. A chave aparece UMA vez: copie inteira (começa com $aact_prod_).", "Cadastre uma chave Pix na conta (Pix > Minhas chaves). Só funciona com a conta aprovada."],
    tip: "Avisamos o Asaas automaticamente para mandar os pagamentos para cá." },
  { id: "pagbank", name: "PagBank (PagSeguro)", tagline: "Pix e cartão em página segura do PagBank. Confirma sozinho.", auto: true, pix: "Página segura", card: true,
    keyLabel: "Token", keyPlaceholder: "Token gerado no PagBank", link: "https://minhaconta.pagseguro.uol.com.br/",
    steps: ["Entre na sua conta PagBank pelo computador.", "No menu, abra Vendas > Integrações (ou Venda online > Integrações).", "Clique em Gerar token e copie o código.", "Confira se a conta tem chave Pix cadastrada."] },
  { id: "infinitepay", name: "InfinitePay", tagline: "Link de pagamento com Pix e cartão. Só precisa da sua InfiniteTag. Confirma sozinho.", auto: true, pix: "Página segura", card: true,
    keyLabel: "API Key (opcional)", keyPlaceholder: "inchk_… (pode deixar vazio)", link: "https://app.infinitepay.io",
    steps: ["Abra o app ou a Conta Web da InfinitePay.", "Em Configurações do Checkout, ligue Habilitar checkout integrado.", "Copie sua InfiniteTag (aparece como $seunome) e cole abaixo, sem o $.", "A API Key é opcional: só se quiser opções avançadas."],
    tip: "A InfinitePay não tem ambiente de teste: o valor mínimo é R$ 1,00." },
];

/** WhatsApp > Cobrança: ligar a cobrança pelo bot, escolher o provedor e conectar a conta (com tutorial). */
export function PaymentSettingsCard() {
  const { data: salon } = useWhatsAppSalon();
  const salonId = salon?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [secret, setSecret] = useState("");
  const [handle, setHandle] = useState("");

  const query = useQuery({
    queryKey: ["payment-settings", salonId], enabled: !!salonId,
    queryFn: async () => {
      const [{ data, error }, pix] = await Promise.all([
        whatsappDb.from("salon_payment_settings").select("whatsapp_enabled,provider,methods,pay_at_salon,sandbox,infinitepay_handle,credential_hint,credential_ok_at").eq("salon_id", salonId!).maybeSingle(),
        whatsappDb.from("salons").select("pix_key").eq("id", salonId!).maybeSingle(),
      ]);
      if (error) throw error;
      return { settings: { ...DEFAULTS, ...(data ?? {}) } as Settings, pixKey: (pix.data?.pix_key as string | null) ?? null };
    },
  });
  useEffect(() => { if (query.data) { setS(query.data.settings); setHandle(query.data.settings.infinitepay_handle ?? ""); } }, [query.data]);

  const saved = query.data?.settings;
  const info = PROVIDERS.find(p => p.id === s.provider)!;
  const connected = s.provider !== "pix_manual" && saved?.provider === s.provider && !!saved?.credential_ok_at;
  const ready = s.provider === "pix_manual" ? !!query.data?.pixKey : connected;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await whatsappDb.from("salon_payment_settings").upsert({
        salon_id: salonId, whatsapp_enabled: s.whatsapp_enabled, provider: s.provider,
        methods: s.provider === "pix_manual" ? ["pix"] : s.methods, pay_at_salon: s.pay_at_salon, sandbox: s.sandbox,
      }, { onConflict: "salon_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-settings", salonId] }); toast({ title: "Cobrança salva", description: s.whatsapp_enabled ? (ready ? "O WhatsApp passa a oferecer o pagamento depois do agendamento." : "Falta conectar a conta para começar a cobrar.") : "O WhatsApp não oferece pagamento; o cliente paga no salão." }); },
    onError: () => toast({ title: "Não foi possível salvar", variant: "destructive" }),
  });

  const connect = useMutation({
    mutationFn: async (action: "save" | "test") => {
      // Grava provedor e ambiente antes, para o servidor validar a conta certa.
      const { error: e } = await whatsappDb.from("salon_payment_settings").upsert({ salon_id: salonId, provider: s.provider, sandbox: s.sandbox, methods: s.methods, pay_at_salon: s.pay_at_salon, whatsapp_enabled: s.whatsapp_enabled }, { onConflict: "salon_id" });
      if (e) throw new Error("Não foi possível salvar.");
      const { data, error } = await supabase.functions.invoke("payment-gateway", { body: { action, salonId, provider: s.provider, sandbox: s.sandbox, secret: secret.trim(), handle: handle.trim() } });
      if (error) throw new Error("Não foi possível falar com o servidor. Tente de novo.");
      if (!data?.success) throw new Error(data?.message || "A conexão não deu certo. Confira a chave.");
      return data as { account?: string | null };
    },
    onSuccess: (d) => { setSecret(""); qc.invalidateQueries({ queryKey: ["payment-settings", salonId] }); toast({ title: "Conta conectada ✅", description: d.account ? `Conta: ${d.account}` : "Credencial válida e guardada com segurança." }); },
    onError: (e: Error) => toast({ title: "Não conectou", description: e.message, variant: "destructive" }),
  });

  if (!salonId || query.isLoading) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>;
  const toggleMethod = (m: Method, on: boolean) => setS(v => ({ ...v, methods: on ? [...new Set([...v.methods, m])] : v.methods.filter(x => x !== m).length ? v.methods.filter(x => x !== m) : v.methods }));

  return (
    <div className="space-y-6">
      <Card data-tour="payment-settings-card">
        <CardHeader>
          <CardTitle>Cobrança pelo WhatsApp</CardTitle>
          <CardDescription>Ligado, o cliente recebe as formas de pagamento logo depois de agendar. Pagou, o horário é confirmado sozinho e você é avisado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-2xl border p-4">
            <div><Label htmlFor="pay-enabled" className="text-base">Cobrar pelo WhatsApp</Label>
              <p className="text-sm text-muted-foreground">Desligado, o robô não fala de pagamento e o cliente paga no salão.</p></div>
            <Switch id="pay-enabled" data-tour="payment-enabled" checked={s.whatsapp_enabled} onCheckedChange={v => setS({ ...s, whatsapp_enabled: v })} />
          </div>

          <fieldset className="space-y-3" data-tour="payment-provider">
            <legend className="mb-1 text-sm font-medium">Como você recebe</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map(p => (
                <button key={p.id} type="button" aria-pressed={s.provider === p.id} onClick={() => setS({ ...s, provider: p.id })}
                  className={`flex min-h-24 flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${s.provider === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <span className="flex w-full items-center justify-between gap-2 font-semibold">{p.name}
                    {saved?.provider === p.id && (p.id === "pix_manual" ? !!query.data?.pixKey : !!saved.credential_ok_at) && <CheckCircle2 size={18} className="text-success" aria-label="Conectado" />}</span>
                  <span className="text-xs text-muted-foreground">{p.tagline}</span>
                  {p.auto && <span className="mt-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Confirmação automática</span>}
                </button>
              ))}
            </div>
          </fieldset>

          {s.provider !== "pix_manual" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O que oferecer no WhatsApp</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={s.methods.includes("pix")} onCheckedChange={v => toggleMethod("pix", v === true)} />Pix <span className="text-muted-foreground">({info.pix})</span></label>
                {info.card && <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={s.methods.includes("card")} onCheckedChange={v => toggleMethod("card", v === true)} />Cartão de crédito</label>}
              </div>
            </fieldset>
          )}
          <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={s.pay_at_salon} onCheckedChange={v => setS({ ...s, pay_at_salon: v === true })} />Deixar o cliente escolher “Pagar no salão”</label>

          <Button type="button" data-tour="payment-save" onClick={() => save.mutate()} disabled={save.isPending} className="min-h-11">{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar cobrança</Button>
          {s.whatsapp_enabled && !ready && <p role="status" className="rounded-xl bg-warning/15 p-3 text-sm">{s.provider === "pix_manual" ? "Cadastre a Chave PIX em Configurações para o WhatsApp oferecer o Pix." : "Conecte a conta abaixo: até lá o WhatsApp não oferece o pagamento."}</p>}
        </CardContent>
      </Card>

      <Card data-tour="payment-tutorial">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound size={20} aria-hidden />Passo a passo: {info.name}</CardTitle>
          <CardDescription>{info.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="space-y-3">
            {info.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span><span className="pt-1">{step}</span></li>
            ))}
          </ol>
          {info.link && <a href={info.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">Abrir o {info.name}<ExternalLink size={14} aria-hidden /></a>}
          {info.tip && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{info.tip}</p>}

          {s.provider !== "pix_manual" && (
            <form className="space-y-4 rounded-2xl border p-4" onSubmit={e => { e.preventDefault(); connect.mutate("save"); }}>
              {s.provider === "infinitepay" && (
                <div className="space-y-1.5"><Label htmlFor="pay-handle">InfiniteTag</Label>
                  <Input id="pay-handle" value={handle} onChange={e => setHandle(e.target.value)} placeholder="seunome (sem o $)" autoComplete="off" spellCheck={false} /></div>
              )}
              <div className="space-y-1.5"><Label htmlFor="pay-secret">{info.keyLabel}</Label>
                <Input id="pay-secret" type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder={connected && saved?.credential_hint ? `Salva: ${saved.credential_hint} (cole outra para trocar)` : info.keyPlaceholder} autoComplete="off" spellCheck={false} />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} aria-hidden />Guardada só no servidor, numa área protegida do banco. Esta tela nunca mostra a chave de novo, só os últimos 4 caracteres.</p></div>
              {s.provider !== "infinitepay" && <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={s.sandbox} onCheckedChange={v => setS({ ...s, sandbox: v === true })} />Modo de teste (sandbox) — só para testar, não recebe dinheiro de verdade</label>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" data-tour="payment-connect" disabled={connect.isPending || (s.provider === "infinitepay" ? !handle.trim() : !secret.trim())} className="min-h-11">{connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Conectar e testar</Button>
                {connected && <Button type="button" variant="outline" className="min-h-11" disabled={connect.isPending} onClick={() => connect.mutate("test")}>Testar de novo</Button>}
              </div>
              {connected && <p role="status" className="flex items-center gap-2 text-sm text-success"><CheckCircle2 size={16} aria-hidden />Conectado{saved?.credential_hint ? ` (${saved.credential_hint})` : ""}{saved?.sandbox ? " · modo de teste" : ""}.</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
