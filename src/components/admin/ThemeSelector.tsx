import { useState, useEffect } from "react";
import { Palette as PaletteIcon, Check, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MODE_KEY,
    PALETTE_KEY,
    PALETTES,
    applyAppearance,
    clearPalette,
    migratePreferences,
    readMode,
    readPalette,
    writePreference,
    type Mode,
} from "@/lib/themePreferences";

/**
 * Aparência da interface administrativa. Modo claro/escuro é global (preferência do usuário);
 * a paleta opcional só vale enquanto a área administrativa está montada.
 */
export const ThemeSelector = () => {
    const [mode, setMode] = useState<Mode>(() => {
        migratePreferences();
        return readMode();
    });
    const [palette, setPalette] = useState(() => readPalette());

    useEffect(() => {
        applyAppearance(mode, palette);
    }, [mode, palette]);

    // Paleta opcional não vaza para páginas públicas/autenticação.
    useEffect(() => () => clearPalette(), []);

    const selectMode = (next: Mode) => {
        setMode(next);
        writePreference(MODE_KEY, next);
    };

    const selectPalette = (id: string) => {
        const next = PALETTES.find(p => p.id === id);
        if (!next) return;
        setPalette(next);
        writePreference(PALETTE_KEY, id);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Aparência da interface">
                    <PaletteIcon size={20} aria-hidden />
                    <span
                        className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-card"
                        style={{ backgroundColor: palette.hex }}
                        aria-hidden
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Aparência</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <div className="p-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-secondary" role="group" aria-label="Modo de cor">
                        <span className="text-sm font-medium">Modo</span>
                        <div className="flex gap-1">
                            {([["light", Sun, "Claro"], ["dark", Moon, "Escuro"]] as const).map(([value, Icon, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => selectMode(value)}
                                    aria-pressed={mode === value}
                                    aria-label={`Modo ${label.toLowerCase()}`}
                                    className={`min-h-[36px] px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Icon size={14} aria-hidden /> {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Cor de destaque (opcional)</DropdownMenuLabel>
                <div className="p-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Cor de destaque">
                    {PALETTES.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={palette.id === p.id}
                            aria-label={p.name}
                            title={p.name}
                            onClick={() => selectPalette(p.id)}
                            className={`relative h-9 w-9 rounded-full border-2 transition-colors ${palette.id === p.id ? 'border-foreground' : 'border-transparent hover:border-border'}`}
                            style={{ backgroundColor: p.hex }}
                        >
                            {palette.id === p.id && <Check size={14} className="absolute inset-0 m-auto text-white" aria-hidden />}
                        </button>
                    ))}
                </div>
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                    Atual: <span className="text-foreground font-medium">{palette.name}</span>. Não altera as cores da página pública do seu negócio.
                </p>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
