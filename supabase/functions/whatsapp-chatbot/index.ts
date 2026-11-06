import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient } from "../_shared/whatsapp/auth.ts";
import { chatbotReply } from "../_shared/whatsapp/chatbot.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";

serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders});
  try {
    const body=await readRequest(req),db=serviceClient();
    await authorizeSalon(req,db,body.salonId);
    const salonId=body.salonId as string;
    // Chave por salão não existe mais: a IA é configurada pela plataforma (super admin).
    if(body.action==="save_key") throw new WhatsAppError("feature_removed",410);
    if(body.action!=="test" || typeof body.text!=="string" || !body.text.trim() || body.text.length>4000) throw new WhatsAppError("invalid_request");
    // Mesmo pipeline de fatos e ferramentas, sem telefone real, persistência, reserva ou envio.
    const reply=await chatbotReply({db,salonId,phone:"+5511000000000",preview:true},body.text);
    return jsonResponse({success:true,text:reply.text,provider:reply.provider,model:reply.model,preview:true});
  }catch(error){return errorResponse(error);}
});
