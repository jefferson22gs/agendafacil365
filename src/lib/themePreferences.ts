/**
 * Preferências de aparência da INTERFACE da plataforma (não das cores do estabelecimento).
 * Chaves novas com leitura de fallback das legadas `syshair-mode` / `syshair-theme`.
 * Migração idempotente: copia o valor legado para a chave nova uma única vez; nunca apaga outras chaves.
 */
export const MODE_KEY = "agenda-facil-365-mode";
export const PALETTE_KEY = "agenda-facil-365-palette";
export const LEGACY_MODE_KEY = "syshair-mode";
export const LEGACY_PALETTE_KEY = "syshair-theme";

export type Mode = "light" | "dark";

export interface Palette {
  id: string;
  name: string;
  primary: string;      // HSL "H S% L%" usado em fundos de ação com texto branco
  tint: string;         // HSL claro para texto/foco no modo escuro
  hex: string;          // pré-visualização
}

/** Azul aprovado é o padrão; demais são personalização opcional da interface (contraste ≥ 4.5:1 com branco). */
export const PALETTES: Palette[] = [
  { id: "blue", name: "Azul Agenda Fácil", primary: "221 83% 53%", tint: "213 97% 78%", hex: "#2563EB" },
  { id: "rose", name: "Rosa", primary: "336 74% 43%", tint: "330 81% 80%", hex: "#BE185D" },
  { id: "emerald", name: "Esmeralda", primary: "161 94% 26%", tint: "156 72% 67%", hex: "#047857" },
  { id: "purple", name: "Violeta", primary: "262 83% 58%", tint: "255 92% 82%", hex: "#7C3AED" },
  { id: "coral", name: "Coral", primary: "17 88% 40%", tint: "27 96% 72%", hex: "#C2410C" },
];
export const DEFAULT_PALETTE = "blue";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const safeStorage = (): StorageLike | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Copia valor legado para a chave nova se a nova ainda não existir. Pode rodar N vezes. */
export function migratePreferences(storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try {
    if (storage.getItem(MODE_KEY) === null) {
      const legacy = storage.getItem(LEGACY_MODE_KEY);
      if (legacy === "light" || legacy === "dark") storage.setItem(MODE_KEY, legacy);
    }
    if (storage.getItem(PALETTE_KEY) === null) {
      const legacy = storage.getItem(LEGACY_PALETTE_KEY);
      // Antigo padrão "gold" e o antigo "blue" viram o azul aprovado; outras escolhas explícitas são preservadas.
      if (legacy) storage.setItem(PALETTE_KEY, legacy === "gold" ? DEFAULT_PALETTE : legacy);
    }
  } catch {
    /* storage bloqueado: segue com padrão */
  }
}

/** Sem preferência explícita: claro. */
export function readMode(storage: StorageLike | null = safeStorage()): Mode {
  try {
    return storage?.getItem(MODE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function readPalette(storage: StorageLike | null = safeStorage()): Palette {
  let id: string | null = null;
  try {
    id = storage?.getItem(PALETTE_KEY) ?? null;
  } catch {
    id = null;
  }
  return PALETTES.find(p => p.id === id) ?? PALETTES.find(p => p.id === DEFAULT_PALETTE)!;
}

export function writePreference(key: typeof MODE_KEY | typeof PALETTE_KEY, value: string, storage: StorageLike | null = safeStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Aplica modo + paleta no <html>. Só toca nas variáveis de primária; o restante vem do CSS. */
export function applyAppearance(mode: Mode, palette: Palette, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", mode === "dark");
  root.classList.remove("light"); // classe legada
  if (palette.id === DEFAULT_PALETTE) clearPalette(root);
  else {
    root.style.setProperty("--primary", palette.primary);
    root.style.setProperty("--primary-hover", palette.primary);
    root.style.setProperty("--primary-tint", palette.tint);
  }
}

/** Remove a paleta opcional (usado ao sair da área administrativa para não vazar para outras rotas). */
export function clearPalette(root: HTMLElement = document.documentElement): void {
  for (const p of ["--primary", "--primary-hover", "--primary-tint"]) root.style.removeProperty(p);
}
