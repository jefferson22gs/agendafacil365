import { BellRing, CalendarCheck, Check, FileSignature, Mail } from "lucide-react";

// Ilustração do produto (salão fictício). Puramente decorativa: o conteúdo real está no texto ao lado.
const SALON = { name: "Studio Aurora", initials: "SA", color: "#BE185D" };
const SLOTS = ["09:00", "09:30", "10:30", "11:00", "14:00", "15:30"];

export const ProductShowcase = () => (
  <div aria-hidden="true" className="relative mx-auto w-full max-w-[26rem] select-none lg:max-w-none">
    {/* Brilho de fundo */}
    <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.25),transparent)] blur-2xl" />

    {/* Celular com o app do salão */}
    <div className="landing-float mx-auto w-[17.5rem] rounded-[2.75rem] border border-border bg-card p-2.5 shadow-2xl ring-1 ring-black/5 sm:w-[19rem]">
      <div className="overflow-hidden rounded-[2.25rem] bg-background">
        <div className="px-5 pb-6 pt-8 text-white" style={{ backgroundColor: SALON.color }}>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-base font-bold" style={{ color: SALON.color }}>
              {SALON.initials}
            </span>
            <div>
              <p className="text-base font-semibold leading-tight">{SALON.name}</p>
              <p className="text-xs text-white/85">Agende em segundos</p>
            </div>
          </div>
        </div>
        <div className="-mt-3 space-y-3 rounded-t-3xl bg-background px-4 pb-5 pt-4">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">Corte + escova</p>
            <p className="text-xs text-muted-foreground">50 min · com Ana</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Horários de amanhã</p>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((t, i) => (
              <span
                key={t}
                className="rounded-xl border py-2 text-center text-xs font-medium"
                style={i === 2 ? { backgroundColor: SALON.color, borderColor: SALON.color, color: "#fff" } : undefined}
              >
                {t}
              </span>
            ))}
          </div>
          <span className="flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: SALON.color }}>
            Confirmar agendamento
          </span>
        </div>
      </div>
    </div>

    {/* Cartões flutuantes: o que acontece depois */}
    <div className="absolute -left-2 top-16 hidden w-60 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:block lg:-left-10">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: SALON.color }}>
          <BellRing className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{SALON.name}</p>
          <p className="text-xs text-muted-foreground">Faz 30 dias do seu corte. Hora do retorno!</p>
        </div>
      </div>
    </div>

    <div className="absolute -right-2 top-[42%] hidden w-56 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:block lg:right-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Mail className="h-4 w-4 text-primary" /> E-mail com a sua marca
      </div>
      <p className="mt-1 text-xs text-muted-foreground">De: <strong className="font-semibold text-foreground">{SALON.name}</strong></p>
    </div>

    <div className="absolute -left-4 bottom-10 hidden items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur sm:flex lg:-left-12">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold text-foreground">Confirmado no WhatsApp</span>
    </div>

    <div className="absolute -right-4 -bottom-4 hidden items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur md:flex lg:right-0">
      <FileSignature className="h-4 w-4 text-primary" />
      <span className="text-xs font-semibold text-foreground">Contrato assinado digitalmente</span>
      <CalendarCheck className="h-4 w-4 text-success" />
    </div>
  </div>
);
