import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { chatbotReply } from "../_shared/whatsapp/chatbot.ts";
import { evolutionClient, sendTyping } from "../_shared/whatsapp/evolution.ts";
import { processOutboxItem } from "../_shared/whatsapp/outbox.ts";
import { drainBudgetMs, expectedSends, sleep } from "../_shared/whatsapp/latency.ts";
import { corsHeaders, jsonResponse, errorResponse, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Acionado na hora pelo trigger whatsapp_kick_inbound (pg_net) e, como rede de segurança, pelo cron de 1 min.
// Drena a fila em ordem por conversa (claim por telefone) e envia a resposta na mesma invocação.
// Não começa evento novo após 25 s (pg_net/cron encerram a requisição em 30 s). O que ficar, outra invocação pega.
const MAX_EVENTS = 20, TIME_BUDGET_MS = 25_000;
// deno-lint-ignore no-explicit-any
const background = (p: Promise<unknown>) => { try { (globalThis as any).EdgeRuntime?.waitUntil?.(p); } catch { /* sem runtime: segue */ } };

/** Envia já os itens desta resposta (gate por instância respeitado). O que sobrar, o cron do dispatch envia. */
async function sendNow(db: SupabaseClient, eventId: string, expected: number) {
  const deadline = Date.now() + drainBudgetMs(expected);
  let sent = 0;
  while (sent < expected && Date.now() < deadline) {
    if (await processOutboxItem(db, { sourceEvent: eventId })) sent++;
    else await sleep(250); // gate (1 s entre mensagens da conversa) ou outro envio da instância em voo
  }
  return sent;
}

serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  try {
    if(req.method!=="POST") throw new WhatsAppError("invalid_request",405);
    authorizeWorker(req);
    const db=serviceClient();
    const started=Date.now();
    const names=new Map<string,Promise<{name:string;provider:string}|null>>();
    // API oficial: "digitando…" sai no envio (outbox, com o id da mensagem do cliente). Aqui só Evolution.
    const instanceName=(id:string,salonId:string)=>{
      if(!names.has(id)) names.set(id,Promise.resolve(db.from("whatsapp_instances").select("instance_name,provider").eq("id",id).eq("salon_id",salonId).maybeSingle()).then(r=>r.data&&r.data.provider!=="meta"?{name:r.data.instance_name,provider:r.data.provider}:null,()=>null));
      return names.get(id)!;
    };
    let processed=0;
    for(let i=0;i<MAX_EVENTS && Date.now()-started<TIME_BUDGET_MS;i++) {
      const {data,error}=await db.rpc("whatsapp_claim_inbound");
      if(error) throw new WhatsAppError("persistence_failed",503);
      const event=data?.[0]; if(!event) break;
      try {
        const payload=objectValue(event.payload);
        // "Digitando…" best effort: nunca aguardado, nunca derruba a resposta.
        let typed=false;
        const typing=()=>{
          if(typed) return; typed=true;
          background(instanceName(event.instance_id,event.salon_id).then(i=>i?sendTyping(evolutionClient(i.provider),i.name,event.sender_phone,6_000):undefined).catch(()=>undefined));
        };
        const reply=await chatbotReply({db,salonId:event.salon_id,phone:event.sender_phone,eventId:event.id,preview:false,typing,name:typeof payload.name==="string"?payload.name:undefined},String(payload.text??""),{selection:typeof payload.selection==="string"?payload.selection:null,media:payload.media??null,quoted:typeof payload.quotedMessageId==="string"?payload.quotedMessageId:null});
        // Persistência atômica, dedup por origem. Envio só pelo outbox (claim/gate/begin_send), nunca direto.
        // Atendente: várias mensagens (menu interativo, QR do PIX, copia e cola) vão em ordem pela v2.
        const {data:finished,error:finishError}=reply.messages?.length
          ? await db.rpc("whatsapp_finish_inbound_v2",{p_event_id:event.id,p_claim:event.claim_token,p_messages:reply.messages,p_provider:reply.provider,p_model:reply.model})
          : await db.rpc("whatsapp_finish_inbound",{
          p_event_id:event.id,p_claim:event.claim_token,p_response:reply.text,p_provider:reply.provider,p_model:reply.model,
        });
        if(finishError) throw new WhatsAppError("persistence_failed",503);
        processed++;
        // Resposta já está durável no outbox: falha daqui em diante só adia o envio para o cron.
        const expected=finished===true?expectedSends(reply):0;
        if(expected) await sendNow(db,event.id,expected).catch(e=>console.warn("whatsapp_send_now_failed",e instanceof WhatsAppError?e.code:"internal"));
        // Contagem com/sem IA para o painel (sem custo). Falha aqui não desfaz a resposta já gravada: só avisa.
        if(reply.text){
          const {error:logError}=await db.rpc("ai_log_reply",{p_salon_id:event.salon_id,p_event_id:event.id,p_with_ai:reply.provider!=="deterministic",p_kind:reply.model});
          if(logError) console.warn("ai_reply_log_failed",logError.code);
        }
      } catch(error) {
        const code=error instanceof WhatsAppError?error.code:"internal_error";
        const {error:retryError}=await db.from("whatsapp_webhook_events").update({status:event.attempts>=3?"failed":"pending",error_code:code,claim_token:null,lease_until:null,next_attempt_at:new Date(Date.now()+60_000).toISOString()}).eq("id",event.id).eq("salon_id",event.salon_id).eq("claim_token",event.claim_token);
        if(retryError) throw new WhatsAppError("persistence_failed",503);
      }
    }
    return jsonResponse({processed});
  }catch(error){return errorResponse(error);}
});
