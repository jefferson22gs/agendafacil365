import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

/** SDK do Facebook (carregado só quando o dono abre o cadastro). */
interface FBType {
  init(o: Record<string, unknown>): void;
  login(cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>): void;
}
declare global { interface Window { FB?: FBType; fbAsyncInit?: () => void } }

const SDK = "https://connect.facebook.net/pt_BR/sdk.js";
function loadSdk(appId: string): Promise<FBType> {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB!.init({ appId, autoLogAppEvents: false, xfbml: false, version: "v21.0" }); resolve(window.FB!); };
    const s = document.createElement("script");
    s.src = SDK; s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("sdk"));
    document.body.appendChild(s);
  });
}
type Session = { wabaId: string; phoneNumberId: string };

/**
 * "Conectar WhatsApp oficial": Cadastro Incorporado da Meta. O dono autoriza no Facebook; o servidor
 * (meta-embedded-signup) valida a autorização, registra o número e liga o salão à API oficial (botões e "☰ Menu").
 */
export function OfficialConnectCard({ salonId, onConnected }: { salonId: string; onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const session = useRef<Session | null>(null);
  // Config e SDK carregados ao abrir a tela: o FB.login precisa sair direto do clique, senão o navegador bloqueia a janela.
  const ready = useRef<Promise<{ FB: FBType; configId: string }> | null>(null);
  const prepare = () => (ready.current ??= (async () => {
    const { data, error } = await supabase.functions.invoke("meta-embedded-signup", { body: { action: "config", salonId } });
    if (error || !data?.success) throw new Error("config");
    return { FB: await loadSdk(data.appId), configId: String(data.configId) };
  })().catch(e => { ready.current = null; throw e; }));
  useEffect(() => { void prepare().catch(() => undefined); }, [salonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A Meta informa a conta e o número escolhidos por postMessage (WA_EMBEDDED_SIGNUP), separado do `code`.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(e.origin)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (d.event === "FINISH" && d.data?.waba_id && d.data?.phone_number_id) session.current = { wabaId: String(d.data.waba_id), phoneNumberId: String(d.data.phone_number_id) };
        if (d.event === "CANCEL") setMessage({ ok: false, text: "Cadastro cancelado. Você pode tentar de novo quando quiser." });
      } catch { /* mensagens de outros scripts */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const start = async () => {
    setBusy(true); setMessage(null); session.current = null;
    try {
      const { FB, configId } = await prepare();
      const code = await new Promise<string | null>(resolve => FB.login(r => resolve(r.authResponse?.code ?? null), {
        config_id: configId, response_type: "code", override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }));
      if (!code) { setMessage(m => m ?? { ok: false, text: "A autorização não foi concluída." }); return; }
      // O postMessage pode chegar logo depois do callback do login.
      for (let i = 0; i < 20 && !session.current; i++) await new Promise(r => setTimeout(r, 250));
      if (!session.current) throw new Error("session");
      const { data: done, error: doneError } = await supabase.functions.invoke("meta-embedded-signup", { body: { action: "complete", salonId, code, ...session.current } });
      if (doneError || !done?.success) throw new Error("complete");
      setMessage({ ok: true, text: `WhatsApp oficial conectado${done.phoneNumber ? ` (+${done.phoneNumber})` : ""}. O atendimento passa a usar botões e menu.` });
      onConnected();
    } catch {
      setMessage({ ok: false, text: "Não foi possível concluir a conexão oficial. Tente novamente ou fale com o suporte." });
    } finally { setBusy(false); }
  };

  return (
    <Card data-tour="whatsapp-official">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BadgeCheck className="text-primary" aria-hidden />WhatsApp oficial (recomendado)</CardTitle>
        <CardDescription>Conexão aprovada pela Meta: botões e menu clicáveis para o cliente, sem risco de bloqueio por conexão não oficial. Você entra com o Facebook do estabelecimento e escolhe o número.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="brand" className="min-h-11" disabled={busy} onClick={() => void start()} data-tour="whatsapp-official-connect">
          {busy && <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />}Conectar WhatsApp oficial
        </Button>
        {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}
