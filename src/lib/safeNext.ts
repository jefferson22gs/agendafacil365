/** Destino pós-login/cadastro vindo de ?next=. Só caminhos internos ("/..."), nunca "//host" nem URL absoluta. */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const u = new URL(value, "https://x.invalid");
    return u.origin === "https://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
