import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RETURN_PRESETS } from "@/lib/procedureReturns";

interface Props {
  /** Dias (0 = sem retorno). `null` = herdar o padrão do serviço (só quando `inheritLabel` é informado). */
  value: number | null;
  onChange: (days: number | null) => void;
  disabled?: boolean;
  inheritLabel?: string;
  label?: string;
}

/** Seletor rápido de prazo de retorno: presets + personalizado. Botões com 44px e estado anunciado (aria-pressed). */
export function ReturnDaysPicker({ value, onChange, disabled, inheritLabel, label = "Prazo de retorno" }: Props) {
  const id = useId();
  const isPreset = value === null || RETURN_PRESETS.some((p) => p.days === value);
  const options = [...(inheritLabel ? [{ days: null as number | null, label: inheritLabel }] : []), ...RETURN_PRESETS];
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.days;
          return (
            <button key={String(o.days)} type="button" aria-pressed={active} onClick={() => onChange(o.days)}
              className={`min-h-11 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${id}-custom`} className="whitespace-nowrap text-sm">Personalizado</Label>
        <Input id={`${id}-custom`} type="number" inputMode="numeric" min={1} max={3650} className="h-11 w-28"
          placeholder="dias" value={!isPreset && value ? value : ""}
          onChange={(e) => { const n = Math.trunc(Number(e.target.value)); onChange(e.target.value === "" ? 0 : Math.min(3650, Math.max(1, n || 1))); }} />
        <span className="text-sm text-muted-foreground">dias</span>
      </div>
    </fieldset>
  );
}
