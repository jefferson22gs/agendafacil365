import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { chatbotReply } from "../_shared/whatsapp/chatbot.ts";
import { corsHeaders, jsonResponse, errorResponse, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";

serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  try {
    if(req.method!=="POST") throw new WhatsAppError("invalid_request",405);
    authorizeWorker(req);
    const db=serviceClient();
    let processed=0;
    for(let i=0;i<3;i++) {
      const {data,error}=await db.rpc("whatsapp_claim_inbound");
      if(error) throw new WhatsAppError("persistence_failed",503);
      const event=data?.[0]; if(!event) break;
      try {
        const payload=objectValue(event.payload);
        const reply=await chatbotReply({db,salonId:event.salon_id,phone:event.sender_phone,eventId:event.id,preview:false},String(payload.text));
        // Persistência atômica, dedup por origem. Nunca enviar diretamente dentro do consumer.
        const {error:finishError}=await db.rpc("whatsapp_finish_inbound",{
          p_event_id:event.id,p_claim:event.claim_token,p_response:reply.text,p_provider:reply.provider,p_model:reply.model,
        });
        if(finishError) throw new WhatsAppError("persistence_failed",503);
        // Contagem com/sem IA para o painel (sem custo). Falha aqui não desfaz a resposta já gravada: só avisa.
        if(reply.text){
          const {error:logError}=await db.rpc("ai_log_reply",{p_salon_id:event.salon_id,p_event_id:event.id,p_with_ai:reply.provider!=="deterministic",p_kind:reply.model});
          if(logError) console.warn("ai_reply_log_failed",logError.code);
        }
        processed++;
      } catch(error) {
        const code=error instanceof WhatsAppError?error.code:"internal_error";
        const {error:retryError}=await db.from("whatsapp_webhook_events").update({status:event.attempts>=3?"failed":"pending",error_code:code,claim_token:null,lease_until:null,next_attempt_at:new Date(Date.now()+60_000).toISOString()}).eq("id",event.id).eq("salon_id",event.salon_id).eq("claim_token",event.claim_token);
        if(retryError) throw new WhatsAppError("persistence_failed",503);
      }
    }
    return jsonResponse({processed});
  }catch(error){return errorResponse(error);}
});
