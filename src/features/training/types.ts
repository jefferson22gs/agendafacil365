import type { TourId } from "./tourIds";

/** Como o passo avança. O tour nunca clica, preenche, salva ou envia sozinho. */
export type TourStepMode =
  /** Só explica; usuário clica em "Próximo". */
  | "info"
  /** Usuário precisa clicar no alvo (abrir dialog, trocar aba); avança quando o alvo do próximo passo aparece. */
  | "waitForClick";

export type TourPlacement = "top" | "bottom" | "left" | "right" | "auto";

export interface TourStep {
  /** Valor de `data-tour` do elemento destacado. Sem alvo = passo centralizado. */
  target?: TourId;
  title: string;
  body: string;
  tip?: string;
  mode?: TourStepMode;
  placement?: TourPlacement;
  /** Rota onde o passo acontece. Se diferente da atual, o tour navega antes de procurar o alvo. */
  route?: string;
  /** Texto alternativo quando o alvo não existe (lista vazia, recurso desligado). Sem isso o passo é pulado. */
  fallbackBody?: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export type CategoryId =
  | "start"
  | "agenda"
  | "clients"
  | "team"
  | "sales"
  | "finance"
  | "whatsapp"
  | "marketing"
  | "ai"
  | "advanced"
  | "settings"
  | "client-view";

export interface TourDef {
  id: string;
  version: number;
  title: string;
  description: string;
  category: CategoryId;
  /** Rota inicial do tour. */
  route: string;
  /** true = qualquer sub-rota de `route` serve (ex.: o artigo aberto em /admin/training/:id); o tour não navega. */
  matchSubroutes?: boolean;
  steps: TourStep[];
}

export type Difficulty = "fácil" | "médio" | "avançado";

export interface Hotspot {
  /** Posição em % da imagem (0–100). */
  x: number;
  y: number;
  label?: string;
}

export interface ArticleImage {
  /** Caminho em /public. `pending` = captura ainda não feita (não inventamos imagem). */
  src: string;
  alt: string;
  pending?: boolean;
  hotspots?: Hotspot[];
}

export interface ArticleStep {
  text: string;
  image?: ArticleImage;
}

export interface Article {
  id: string;
  version: number;
  title: string;
  summary: string;
  category: CategoryId;
  difficulty: Difficulty;
  minutes: number;
  /** Tela relacionada (botão "Abrir tela"). */
  route?: string;
  /** Tour relacionado (botão "Me mostre onde fazer"). */
  tourId?: string;
  steps: ArticleStep[];
  /** Avisos honestos: recurso demonstrativo, limitações, dependências. */
  notes?: string[];
  keywords?: string[];
}

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
  order: number;
}

export type ProgressKind = "tour" | "article" | "first_steps" | "welcome";
export type ProgressStatus = "in_progress" | "completed" | "skipped" | "viewed";

export interface ProgressRecord {
  item_key: string;
  item_version: number;
  kind: ProgressKind;
  status: ProgressStatus;
  current_step: number;
  metadata: Record<string, unknown>;
  completed_at: string | null;
}

export type FirstStepId =
  | "salon-info"
  | "hours"
  | "service"
  | "professional"
  | "public-link"
  | "share-link"
  | "first-appointment";

export interface FirstStepTask {
  id: FirstStepId;
  title: string;
  description: string;
  route: string;
  tourId?: string;
  articleId?: string;
  done: boolean;
}
