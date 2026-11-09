import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { processOutboxItem } from "../_shared/whatsapp/outbox.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/whatsapp/errors.ts";

// Rede de segurança (cron 1/min). Respostas de conversa saem já no whatsapp-inbound-worker; aqui a fila geral
// usa whatsapp_claim_outbox, que dá prioridade à conversa (gate 1 s) e mantém campanhas a 3 s por instância.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
    authorizeWorker(req);
    const db = serviceClient();
    let processed = 0;
    // Gate persistente coordena instâncias; não tenta ocupar a função por longos sleeps.
    for (let i = 0; i < 10; i++) {
      if (!await processOutboxItem(db)) break;
      processed++;
    }
    return jsonResponse({ processed });
  } catch (error) { return errorResponse(error); }
});
