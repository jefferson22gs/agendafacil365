import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient } from "../_shared/whatsapp/auth.ts";
import { chatbotReply } from "../_shared/whatsapp/chatbot.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { STEPS, type GuidedSession } from "../_shared/whatsapp/guided.ts";

/** Sessão do simulador vinda do navegador: só a forma é validada; nada dela toca o banco (preview). */
function sessionOf(value: unknown): GuidedSession | null {
  const s = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!s || !STEPS.includes(s.step as GuidedSession["step"])) return null;
  const data = s.data && typeof s.data === "object" && JSON.stringify(s.data).length <= 16_000 ? s.data as GuidedSession["data"] : {};
  return { step: s.step as GuidedSession["step"], data, name: typeof s.name === "string" ? s.name.slice(0, 120) : null, takeoverUntil: null, lastAt: null };
}

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
    // Simulador (fluxo guiado): a sessão vai e volta no corpo; `selection` simula o clique em botão/lista.
    const selection=typeof body.selection==="string" && /^[a-z0-9_.]{1,40}$/.test(body.selection)?body.selection:null;
    const reply=await chatbotReply({db,salonId,phone:"+5511000000000",preview:true,name:"Cliente Teste"},body.text,{selection,session:sessionOf(body.session)});
    return jsonResponse({success:true,text:reply.text,provider:reply.provider,model:reply.model,preview:true,messages:reply.messages??null,session:reply.session??null});
  }catch(error){return errorResponse(error);}
});
