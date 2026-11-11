// Tipos mínimos do runtime Deno para checar Edge Functions com tsc (sem instalar Deno). Só para verificação local.
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };
