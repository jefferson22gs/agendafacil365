// Supabase Edge Function: generate-text-content
// Melhora textos de marketing com a IA central da plataforma (provedor/chave definidos só pelo super admin).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { aiChat, AIError, aiErrorResponse, legacyPlatformKey, resolveAI } from "../_shared/ai/gateway.ts";
import { AI_ERROR_TEXT, composeSystemPrompt } from "../_shared/ai/core.ts";

const SYSTEM = `Você é um especialista em marketing digital para salões de beleza.
Seu objetivo é melhorar textos de mensagens para clientes (WhatsApp/SMS).
Aja como um copywriter persuasivo, use emojis adequados (mas não exagere), e mantenha o tom profissional e amigável.
O texto deve ser curto e direto, ideal para leitura rápida no celular. Mantenha as variáveis como {nome} intactas.
Responda somente com o texto final, sem explicações.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    await authorizeSalon(req, db, body.salonId);
    const salonId = body.salonId as string;
    const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 1000) : "";
    if (!text.trim() && !instruction.trim()) throw new WhatsAppError("invalid_request");

    // Provedor escolhido pelo cliente (body.provider) é ignorado: só a plataforma decide. Cota reservada dentro de aiChat.
    const ai = await resolveAI(db, () => legacyPlatformKey(db, ["gemini", "groq", "openai"]));
    if (!ai) return jsonResponse({ success: false, code: "not_configured", error: AI_ERROR_TEXT.not_configured }, 503);

    const user = instruction ? `${instruction}\n\nTexto original para base (opcional): "${text}"` : `Melhore este texto para ficar mais atraente: "${text}"`;
    const out = await aiChat(db, ai, { salonId, feature: "texto", messages: [{ role: "system", content: composeSystemPrompt(ai.cfg, SYSTEM, "texto") }, { role: "user", content: user }], maxTokens: Math.max(ai.maxTokens, 800) });
    if (!out.text.trim()) throw new AIError("unavailable");
    return jsonResponse({ success: true, text: out.text.trim() });
  } catch (error) {
    return error instanceof AIError ? aiErrorResponse(error) : errorResponse(error);
  }
});
