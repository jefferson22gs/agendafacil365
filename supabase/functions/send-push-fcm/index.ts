// Edge Function: send-push-fcm — envio FCM escopado por salão. Ver _shared/push/handler.ts.
// Exige JWT do dono/admin do salão (validado no servidor) ou chave secreta do projeto (chamada interna).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleSend } from "../_shared/push/handler.ts";

serve(handleSend);
