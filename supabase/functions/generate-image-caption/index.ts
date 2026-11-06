import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { aiChat, AIError, aiErrorResponse, legacyPlatformKey, resolveAI } from "../_shared/ai/gateway.ts";
import { AI_ERROR_TEXT, composeSystemPrompt } from "../_shared/ai/core.ts";

const PROMPT = "Escreva uma legenda curta em português brasileiro para esta imagem do salão. Não invente preços nem promoções. Máximo 150 caracteres. Responda só com a legenda.";

serve(async(req)=>{
  if(req.method === "OPTIONS") return new Response(null,{headers:corsHeaders});
  try {
    const body=await readRequest(req),db=serviceClient();
    await authorizeSalon(req,db,body.salonId);
    const salonId=body.salonId as string;
    // Sem fetch de URL fornecida pelo usuário: evita SSRF e download sem limite.
    if(typeof body.imageBase64!=="string" || body.imageBase64.length>400_000) throw new WhatsAppError("invalid_request");
    const image=body.imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(!image) throw new WhatsAppError("invalid_request");
    const geminiModel=Deno.env.get("GEMINI_CAPTION_MODEL") || undefined;
    const ai=await resolveAI(db,()=>legacyPlatformKey(db,["gemini"],geminiModel));
    if(!ai) return jsonResponse({success:false,code:"not_configured",error:AI_ERROR_TEXT.not_configured},503);
    if(ai.provider!=="gemini") return jsonResponse({success:false,code:"not_configured",error:"A IA configurada não lê imagens. Escreva a legenda manualmente."},503);
    const system=composeSystemPrompt(ai.cfg,"","legenda");
    const out=await aiChat(db,ai,{salonId,feature:"legenda",maxTokens:Math.max(ai.maxTokens,400),messages:[
      ...(system?[{role:"system" as const,content:system}]:[]),
      {role:"user",content:PROMPT,image:{mime:image[1],data:image[2]}},
    ]});
    const caption=out.text.trim().slice(0,300);
    if(!caption) throw new AIError("unavailable");
    return jsonResponse({success:true,caption});
  }catch(error){return error instanceof AIError?aiErrorResponse(error):errorResponse(error);}
});
