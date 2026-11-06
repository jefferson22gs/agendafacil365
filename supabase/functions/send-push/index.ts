// Edge Function: send-push — alias legado. Mesmo handler seguro do send-push-fcm (antes enviava sem validar quem chamava).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleSend } from "../_shared/push/handler.ts";

serve(handleSend);
