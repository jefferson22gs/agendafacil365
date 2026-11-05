import { supabase } from "@/integrations/supabase/client";

export type PlanKey = "monthly" | "annual";

/** Recebedor das assinaturas (InfiniteTag pública). Exibição apenas; o servidor usa INFINITEPAY_HANDLE. */
export const INFINITEPAY_TAG = "$marco-boggian";

const MESSAGES: Record<string, string> = {
  demo_unavailable: "Indisponível na demonstração: nenhum pagamento será iniciado.",
  unauthorized: "Entre na sua conta para assinar.",
  salon_missing: "Configure seu estabelecimento antes de assinar.",
  invalid_plan: "Plano inválido.",
  provider_unavailable: "A InfinitePay não respondeu. Tente novamente em instantes.",
  configuration_missing: "Pagamento por InfinitePay ainda não foi ativado pela equipe.",
};

/**
 * Pede ao servidor um link de pagamento InfinitePay (Pix ou cartão) para o plano escolhido.
 * Preço e recebedor são definidos no servidor; o pagamento só libera acesso após confirmação
 * do servidor junto à InfinitePay (webhook + payment_check).
 */
export async function createInfinitePayCheckout(plan: PlanKey): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("infinitepay-checkout", {
    body: { plan, redirect_url: `${window.location.origin}/admin/subscription?status=processing&provider=infinitepay` },
  });
  if (data?.url) {
    const checkout = new URL(data.url);
    if (checkout.protocol === "https:" && checkout.hostname === "checkout.infinitepay.io" && !checkout.username && !checkout.password) return checkout.href;
    throw new Error("Endereço de pagamento inválido. Procure o suporte.");
  }
  let code = data?.error;
  // supabase-js coloca o corpo de erro HTTP em error.context (Response).
  const ctx = (error as { context?: Response } | null)?.context;
  if (!code && ctx && typeof ctx.json === "function") code = (await ctx.json().catch(() => null))?.error;
  throw new Error(MESSAGES[code ?? ""] ?? "Não foi possível iniciar o pagamento. Tente novamente.");
}
