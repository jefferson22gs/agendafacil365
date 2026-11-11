import type { ReactNode } from "react";
import { Accessibility, Check, FileSignature, Mail, MessageCircle, Palette, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";

interface Block { id: string; icon: typeof RotateCcw; eyebrow: string; title: string; text: string; points: string[]; art: ReactNode }

/** Ilustrações decorativas (aria-hidden): o conteúdo real está no texto. */
const ReturnsArt = () => (
  <div className="space-y-3">
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">Prazo de retorno do serviço</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {["15 dias", "30 dias", "90 dias · Botox", "180 dias"].map((t, i) => (
          <span key={t} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${i === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"}`}>{t}</span>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      {[{ n: "12", l: "Vencem hoje" }, { n: "38", l: "Próximos 7 dias" }, { n: "21", l: "Já voltaram" }].map(({ n, l }) => (
        <div key={l} className="rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
          <p className="text-lg font-bold text-foreground sm:text-xl">{n}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
    <p className="text-[11px] text-muted-foreground">Painel ilustrativo, dados de exemplo.</p>
    <div className="flex flex-wrap gap-2">
      {[{ i: MessageCircle, t: "WhatsApp" }, { i: Mail, t: "E-mail" }, { i: Smartphone, t: "App" }].map(({ i: I, t }) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-foreground">
          <I className="h-3.5 w-3.5 text-success" /> {t}
        </span>
      ))}
    </div>
  </div>
);

const BrandArt = () => (
  <div className="flex items-end justify-center gap-4">
    {[{ c: "#BE185D", n: "Studio Aurora", i: "SA" }, { c: "#0F766E", n: "Barbearia Navalha", i: "BN" }, { c: "#7C3AED", n: "Clínica Lumi", i: "CL" }].map((s, k) => (
      <div key={s.n} className={`w-28 overflow-hidden rounded-3xl border border-border bg-card shadow-md ${k === 1 ? "mb-6" : ""}`}>
        <div className="flex flex-col items-center gap-2 px-3 py-5 text-white" style={{ backgroundColor: s.c }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold" style={{ color: s.c }}>{s.i}</span>
          <span className="text-center text-[11px] font-semibold leading-tight">{s.n}</span>
        </div>
        <div className="space-y-1.5 p-3">
          <span className="block h-2 rounded bg-muted" />
          <span className="block h-2 w-2/3 rounded bg-muted" />
          <span className="mt-2 block h-6 rounded-lg" style={{ backgroundColor: s.c }} />
        </div>
      </div>
    ))}
  </div>
);

const ContractArt = () => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileSignature className="h-4 w-4 text-primary" /> Contrato de licenciamento</div>
    <div className="mt-3 space-y-1.5">
      {[100, 92, 96, 70].map((w) => <span key={w} className="block h-2 rounded bg-muted" style={{ width: `${w}%` }} />)}
    </div>
    <ul className="mt-4 space-y-2">
      {["Agenda Fácil 365 — assinado", "Seu negócio — assinado"].map((t) => (
        <li key={t} className="flex items-center gap-2 text-xs text-foreground"><Check className="h-4 w-4 text-success" /> {t}</li>
      ))}
    </ul>
    <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">SHA-256 · a3f9c1…e72b</p>
  </div>
);

const A11yArt = () => (
  <div className="grid grid-cols-2 gap-3">
    {[
      { bg: "#FDE68A", fg: "#0F172A", l: "Cor clara → texto escuro" },
      { bg: "#1E3A8A", fg: "#FFFFFF", l: "Cor escura → texto claro" },
    ].map((s) => (
      <div key={s.l} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <span className="flex h-11 items-center justify-center rounded-xl text-sm font-semibold" style={{ backgroundColor: s.bg, color: s.fg }}>Agendar</span>
        <p className="mt-2 text-[11px] text-muted-foreground">{s.l}</p>
      </div>
    ))}
    <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <Accessibility className="h-8 w-8 shrink-0 text-primary" />
      <p className="text-xs text-foreground">Contraste mínimo de 4,5:1, alvos de toque grandes e navegação por teclado e leitor de tela.</p>
    </div>
  </div>
);

const blocks: Block[] = [
  {
    id: "retornos", icon: RotateCcw, eyebrow: "Retorno automático", title: "Clientes que voltam sem você precisar lembrar",
    text: "Defina o prazo de retorno de cada procedimento — corte, coloração, Botox, limpeza — e o sistema avisa o cliente na data certa, às 9h.",
    points: ["Prazo por serviço e ajuste por cliente", "Lembrete por WhatsApp, e-mail e no app", "Painel com quem vence hoje, atrasados e quem voltou"],
    art: <ReturnsArt />,
  },
  {
    id: "marca", icon: Palette, eyebrow: "Sua marca em primeiro lugar", title: "Um app com a logo e as cores do seu negócio",
    text: "Seus clientes instalam o app do seu salão na tela do celular, com o seu ícone. E os e-mails chegam com o nome e a logo do seu negócio.",
    points: ["App instalável com ícone próprio", "Página de agendamento nas suas cores", "E-mails enviados em nome do seu negócio"],
    art: <BrandArt />,
  },
  {
    id: "contrato", icon: ShieldCheck, eyebrow: "Segurança jurídica", title: "Contrato claro, assinado digitalmente",
    text: "Na contratação, o contrato é preenchido com os seus dados e assinado eletronicamente pelas duas partes, com validade jurídica e registro de integridade.",
    points: ["Assinatura eletrônica via Autentique", "Termos de proteção de dados (LGPD) incluídos", "Comprovante com hash SHA-256"],
    art: <ContractArt />,
  },
  {
    id: "acessibilidade", icon: Accessibility, eyebrow: "Acessível para todos", title: "Feito para todo cliente conseguir agendar",
    text: "Seguimos as diretrizes internacionais WCAG 2.2 nível AA. Mesmo com qualquer cor de marca, o texto continua legível.",
    points: ["Contraste ajustado automaticamente", "Botões e horários fáceis de tocar", "Compatível com leitores de tela"],
    art: <A11yArt />,
  },
];

export const InnovationSection = () => (
  <section id="novidades" aria-labelledby="novidades-title" className="scroll-mt-20 bg-background py-16 md:py-28">
    <div className="container px-4">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Novidades</p>
        <h2 id="novidades-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          Mais clientes voltando. Mais confiança no seu negócio.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">Recursos que trabalham por você enquanto você atende.</p>
      </div>

      <div className="space-y-20 md:space-y-28">
        {blocks.map(({ id, icon: Icon, eyebrow, title, text, points, art }, i) => (
          <article key={id} id={id} className="landing-reveal grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={i % 2 ? "lg:order-2" : ""}>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <Icon className="h-4 w-4" aria-hidden /> {eyebrow}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h3>
              <p className="mt-4 text-lg text-muted-foreground">{text}</p>
              <ul className="mt-6 space-y-3">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-foreground">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden="true" className={`relative rounded-[2rem] border border-border bg-surface-1 p-4 sm:p-10 ${i % 2 ? "lg:order-1" : ""}`}>
              <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_60%)]" />
              {art}
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
