import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { drainOutbox } from "../_shared/whatsapp/outbox.ts";
import { evolutionClient } from "../_shared/whatsapp/evolution.ts";
import { deliveryUpdates, messageRecords } from "../_shared/whatsapp/inbound.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/whatsapp/errors.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rede de segurança (cron 1/min). Respostas de conversa saem já no whatsapp-inbound-worker; aqui a fila geral
// usa whatsapp_claim_outbox, que dá prioridade à conversa (gate 1 s) e mantém campanhas a 3 s por instância.

/**
 * Consulta ativa de entrega: a Evolution 2.3.7 só manda MESSAGES_UPDATE quando o Baileys recebe o ack e a
 * mensagem original está na tabela Message dela; quando nada chega, lemos MessageUpdate[].status em
 * /chat/findMessages (where.key.id) e promovemos "Enviada" -> "Entregue"/"Lida". Best effort, nunca derruba o envio.
 */
export async function checkDeliveries(db: SupabaseClient, api?: ReturnType<typeof evolutionClient>): Promise<number> {
  const { data, error } = await db.rpc("whatsapp_delivery_candidates", { p_limit: 20 });
  if (error || !Array.isArray(data)) return 0;
  let promoted = 0;
  for (const row of data as { salon_id: string; instance_id: string; instance_name: string; provider_message_id: string; provider?: string }[]) {
    // API oficial (id "wamid."): entregue/lida chegam pelo webhook da Meta; não existe consulta na Evolution.
    if (row.provider_message_id.startsWith("wamid.")) continue;
    try {
      // A conexão que enviou (Evolution ou QR Code com botões) responde pelo próprio servidor.
      if (row.provider && row.provider !== "evolution") continue; // Whaileys API: sem consulta de entrega
      const client = api ?? evolutionClient();
      const remote = await client.request("messages", row.instance_name, { where: { key: { id: row.provider_message_id } }, page: 1, offset: 5 });
      for (const u of deliveryUpdates(messageRecords(remote))) {
        if (u.id !== row.provider_message_id || u.status === "sent") continue;
        const { error: e } = await db.rpc("whatsapp_record_delivery", { p_salon_id: row.salon_id, p_instance_id: row.instance_id, p_message_id: u.id, p_status: u.status });
        if (!e) promoted++;
      }
    } catch { /* próxima verificação (espera crescente no banco) */ }
  }
  return promoted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
    authorizeWorker(req);
    const db = serviceClient();
    // Gate persistente coordena instâncias; a espera pelo gate é curta (3 s) e limitada por orçamento.
    const processed = await drainOutbox(db);
    const deliveries = await checkDeliveries(db).catch(() => 0);
    return jsonResponse({ processed, deliveries });
  } catch (error) { return errorResponse(error); }
});
