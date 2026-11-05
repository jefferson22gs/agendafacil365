/**
 * Transição para supabase/pending/20261105000100_security_subscriptions_notifications_rls.sql.
 * Só cai no caminho antigo quando a RPC AINDA NÃO EXISTE no banco. Recusa da RPC (não dono, já existe,
 * permissão) NÃO cai no fallback — senão o endurecimento seria contornado pelo próprio cliente.
 * ponytail: remover este arquivo e os fallbacks depois que a migração estiver aplicada em produção.
 */
export const isMissingRpc = (error: { code?: string } | null | undefined): boolean =>
  !!error && (error.code === "PGRST202" || error.code === "42883");

type RpcResult<T> = { data: T | null; error: { code?: string; message?: string } | null };
type RpcCaller = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult<unknown>> };

/** Chama RPC ainda ausente dos tipos gerados (src/integrations/supabase/types.ts) sem `any`. */
export const callRpc = async <T>(client: unknown, fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> =>
  (await (client as RpcCaller).rpc(fn, args)) as RpcResult<T>;
