import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pixelEnabled, readConsent, setConsent } from "@/lib/metaPixel";

/** Pergunta uma vez se pode medir anúncios. Sem Pixel configurado, não aparece. */
export function ConsentBanner() {
  const [open, setOpen] = useState(() => pixelEnabled() && readConsent() === null);
  if (!open) return null;
  const choose = (v: "granted" | "denied") => { setConsent(v); setOpen(false); };
  return (
    <section role="region" aria-label="Privacidade e cookies" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border bg-card p-4 text-card-foreground shadow-lg sm:inset-x-6">
      <p className="text-sm">Usamos cookies da Meta (Facebook e Instagram) para medir nossos anúncios. Você pode recusar sem perder nenhuma função do site. <a href="/privacidade#cookies" className="text-primary underline">Política de Privacidade</a></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="min-h-11" onClick={() => choose("granted")}>Aceitar</Button>
        <Button variant="outline" className="min-h-11" onClick={() => choose("denied")}>Recusar</Button>
      </div>
    </section>
  );
}
