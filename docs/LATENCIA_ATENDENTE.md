# Latência do atendente WhatsApp

Meta: p50 ≤ 8 s e p95 ≤ 15 s, do recebimento ao envio aceito pela Evolution.

## Antes (medido em 15 conversas, 07–08/11)
webhook → evento salvo → **espera do cron inbound (até 60 s)** → processamento (4–52 s) → outbox → **espera do cron de envio (~54–62 s)** → Evolution. Total 64–131 s. O Gemini em si leva ~1,8 s.

## Agora
1. **Kick do worker inbound**: trigger `whatsapp_kick_inbound` (AFTER INSERT em `whatsapp_webhook_events`) chama `invoke_edge_function('whatsapp-inbound-worker')` via pg_net. O pg_net só envia depois do COMMIT, então o webhook responde ao Evolution sem atraso. Coalescido por conversa: rajada do mesmo cliente aciona um worker só. Reentrega do webhook (ON CONFLICT DO NOTHING) não aciona nada. Campanhas não passam por aqui.
2. **Envio na mesma invocação**: depois de gravar a resposta no outbox (`whatsapp_finish_inbound*`, atômico e idempotente), o worker faz o claim só dos itens desse evento (`whatsapp_claim_outbox_v2(p_source_event)`) e envia pelo mesmo caminho de sempre (`whatsapp_begin_send`, gate, `whatsapp_finish_outbox`). Se falhar ou passar do tempo, o item continua pendente e o cron envia.
3. **Fila**: conversa (`category='chatbot'`) sai antes de campanhas, com gate de 1 s desde o último envio da instância; os demais continuam a 3 s. Pausas (desconectado/limite: +5 min) valem para todos. Mensagens da mesma resposta ficam em ordem por `scheduled_for` (+1 ms), sem os 2 s artificiais.
4. **Ordem por conversa**: `whatsapp_claim_inbound` não pega uma mensagem enquanto outra do mesmo telefone estiver em processamento ou pendente antes dela, e assim vários workers podem rodar juntos.
5. **Processamento**: estado, config, destinatário de Insights e limite de rajada são lidos uma vez e em paralelo. Config/chave da IA, base de conhecimento, histórico e catálogo também são lidos em paralelo. O salão e as automações ficam em cache por mensagem. As ferramentas só de leitura rodam em paralelo. Para catálogo pequeno (≤ 40 serviços e ≤ 20 profissionais), os serviços e profissionais vão no prompt, o que poupa uma ida à IA. `start_booking` abre os menus sem um 2º turno de IA. O raciocínio do chatbot fica sempre em LOW. A busca de datas (21 dias × profissionais) agora roda em lotes paralelos.
6. **"Digitando…"**: `POST /chat/sendPresence/{instance}` com `{ number, presence: "composing", delay }`, conferido em Evolution 2.3.7 (`presenceSchema`). Só é enviado quando o bot vai responder, nunca é aguardado e uma falha é ignorada.
7. **Nunca grupo**: `isPrivateChat` (inbound.ts) é chamado no webhook e no `parseIncoming`. As funções `whatsapp_finish_inbound*` ignoram evento cujo telefone não está em E.164 (`error_code='not_private_chat'`). A CHECK `whatsapp_outbox_chatbot_private` impede resposta de chatbot sem destino individual, e `outbox.ts` cancela qualquer item de chatbot com número inválido.

## Estimativa por etapa (típico)
| Etapa | Antes | Agora |
|---|---|---|
| Espera até o worker | 0–60 s | ~0,3–1 s (pg_net + cold start) |
| Leituras antes da IA | 1–3 s (sequenciais) | ~0,3–0,6 s |
| IA | 1,8 s por turno, 1–3 turnos | 1,8 s, normalmente 1 turno |
| Espera até o envio | ~54–62 s | 0 s (mesma invocação) |
| Envio (Evolution) | ~1 s | ~1 s (+1 s por mensagem extra) |
| **Total** | 64–131 s | **~3–6 s** (fluxo de menus sem IA: ~2–3 s) |

## Medir
Painel do super admin → IA → Consumo → "Tempo de resposta do atendente" (7 dias).
SQL: `SELECT public.whatsapp_reply_latency(now()-interval '7 days', now());`
O cálculo usa `created_at` do evento e `completed_at` do 1º item enviado, campos que já existiam.

## Custo e riscos
- Uma invocação da Edge Function por conversa ativa (além do cron). Uma rajada da mesma conversa conta como uma só.
- Durante o envio imediato, o worker fica ocupado até ~12 s (orçamento por resposta).
- Uma campanha grande não gera kick (só mensagens recebidas geram) e continua espaçada a 3 s. A conversa passa na frente.
