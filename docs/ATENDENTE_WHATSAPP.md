# Atendente WhatsApp

O link público do salão também funciona por conversa no WhatsApp: a IA conversa e, para agendar, abre um fluxo de menus que roda **sem IA**.

## Fluxo
1. A pessoa pede para agendar. A IA chama `start_booking`, e o servidor manda o primeiro menu.
2. Os menus seguem esta ordem: serviço (preço e duração do cadastro), profissional ou "Qualquer profissional", dias com horário livre (21 dias), horários livres (`get_available_time_slots`).
3. Cadastro: nome completo, se o WhatsApp da conversa é o do cadastro (ou outro número, normalizado para E.164) e data de nascimento (opcional; aceita `pular`). Se o cliente já existe pelo `phone_normalized`, os dados que ele já tem não são pedidos de novo.
4. Cupom (opcional), validado no servidor por `whatsapp_coupon_eval` com as mesmas regras do link público.
5. Resumo, depois **Confirmar** (voto na enquete, `1`, `sim`, `confirmar`, `CONFIRMAR` ou `confirmo`). Em seguida roda `whatsapp_book_appointment_v2`, que é transacional, idempotente por `request_key`, respeita `chatbot_booking_enabled` e devolve o status real (`pending` ou `confirmed`).
6. Com `salons.pix_key` e valor > 0, o cliente escolhe entre **Pagar agora (PIX)** e **Pagar no salão**. Se escolher PIX, recebe o QR (PNG), o copia e cola (com botão "Copiar código PIX" quando os interativos estão ligados) e o pedido de comprovante.
7. O comprovante (foto/PDF ≤ 5 MB) vai para `appointment_payment_proofs` e para o bucket privado `payment-proofs`. O dono recebe uma notificação. O sistema **nunca** diz que o pagamento foi confirmado.

## Um caminho só de reserva (correção de 09/11)
- Causa da falha do teste: `whatsapp_book_appointment_v2` caía no trigger `trigger_set_cancellation_token` → `generate_cancellation_token()`, que chamava `gen_random_bytes` sem esquema (pgcrypto está em `extensions`, a RPC roda com `search_path=public`): `42883`. Corrigido em `20261109000250` (já aplicada).
- Além disso, `CONFIRMAR` com proposta antiga (`pending_action.kind='booking'`, de `prepare_booking`) ia para a RPC v1 e devolvia "Não consegui reservar esse horário" sem registrar nada. A v1 não é mais chamada: proposta antiga vira o passo de revisão do fluxo e confirma pela v2. `prepare_booking` saiu das ferramentas da IA.
- Erro da RPC grava `whatsapp_webhook_events.error_code = booking_rpc_<motivo|SQLSTATE>` e um log sem dados pessoais. Erro inesperado mantém o fluxo e o mesmo `request_key` (repetir CONFIRMAR não duplica).
- `20261109000300` acrescenta `extensions` ao `search_path` de qualquer função de `public` que ainda chame pgcrypto/uuid-ossp sem esquema.

## Escolhas: enquete nativa (o que aparece no celular)
- Código oficial conferido (tag 2.3.7): `whatsapp.baileys.service.ts` `pollMessage` (`sendPoll`), `buttonMessage` (`sendButtons`: `reply`, `copy`, `url`, `call`, `pix` via `nativeFlowMessage` dentro de `viewOnceMessage.interactiveMessage`), `listMessage` (`listType: 2`); `src/validate/message.schema.ts` (`pollMessageSchema`: 2–10 opções únicas).
- Lista e botões "reply" não aparecem de forma confiável em contas comuns (Baileys); no teste de 09/11 as 23 interativas foram salvas pela Evolution como `conversation` (texto). Por isso **todo menu agora sai como enquete** (`POST /message/sendPoll/{instance}`, `selectableCount: 1`): título curto, descrição, opções numeradas "1. Corte · R$ 45,00 · 15 min", "Ver mais horários" na paginação e o nome do salão no fim. Até 10 opções (limite do schema 2.3.7, não 12), opção ≤ 100 e nome ≤ 255 caracteres. Menu de uma opção vai como texto.
- Fallback: o `text_content` do outbox leva a versão numerada. Se a Evolution recusar a enquete (4xx), sai o texto. Respostas aceitas: id clicado, número ("2", "opção 2", "2️⃣"), nome exato da opção; texto livre volta para a IA. Desligar: `whatsapp_automation_settings.interactive_enabled`.
- Voto: a Evolution 2.3.7 descriptografa e manda em `messages.upsert` (`pollUpdateMessage.vote.selectedOptions` = nomes) e em `messages.update` (`pollUpdates[{name, voters}]`). O webhook só aceita voto de conversa individual, com uma opção, numa enquete que **nós** enviamos a esse mesmo telefone (`whatsapp_outbox.remote_message_id`); o nome vira o id do menu pelo `payload.options` dessa mensagem. Sem IA.
- Honestidade: a enquete depende do aparelho/versão do WhatsApp do cliente (WhatsApp Web antigo e alguns clientes de terceiros mostram só o texto). O voto depende da Evolution conseguir descriptografar; se não conseguir, o cliente ainda pode digitar o número. O botão "Copiar código PIX" (`copy`, native flow) pode não aparecer em todos os aparelhos; o código vai também no texto.

## Status na Central (honesto)
- `whatsapp_messages.status`: `queued` (Na fila: outbox pendente/processando) → `sent` (Enviada ao WhatsApp, um tique: Evolution aceitou) → `delivered` (Entregue, dois tiques) → `read` (Lida, dois tiques azuis); `failed`/`uncertain` com motivo e **Tentar de novo** (`whatsapp-instances` `retry_message` → `whatsapp_retry_outbox`, idempotente). Status nunca regride.
- Confirmação de entrega: `messages.update` da 2.3.7 manda `keyId` + `status` em texto (`SERVER_ACK`, `DELIVERY_ACK`, `READ`, `PLAYED` — `src/utils/renderStatus.ts`), mas só quando a mensagem original está na tabela `Message` da Evolution. O parser aceita texto, número, `update.status` e `MessageUpdate[]`. Como nenhuma confirmação chegava no teste, o `whatsapp-dispatch` (cron 1 min) também consulta ativamente `POST /chat/findMessages/{instance}` com `where.key.id` para mensagens "Enviada" entre 30 s e 24 h (espera crescente até 30 min) e promove para Entregue/Lida. Qual dos dois resolve em produção: ver `whatsapp_messages.delivery_checks` > 0 com status `delivered/read` (consulta ativa) vs. promoções sem consulta (webhook).

## Atraso da Evolution
- O webhook grava `whatsapp_webhook_events.whatsapp_at` (`messageTimestamp`, precisão de 1 s). `whatsapp_reply_latency_v2` devolve p50/p95 do atraso da Evolution (WhatsApp → webhook) e do total "celular do cliente → resposta aceita". O cartão do super admin mostra separado "Tempo do sistema" e "Atraso da Evolution", com alerta quando o p95 da Evolution passa de 15 s.

## Grupos
- `whatsapp-instances` `set_groups_ignore` (dono/admin): lê `GET /settings/find/{instance}` e reenvia `POST /settings/set/{instance}` com o conjunto exigido pelo `settingsSchema` 2.3.7 (`rejectCall`, `msgCall`, `groupsIgnore`, `alwaysOnline`, `readMessages`, `readStatus`, `syncFullHistory`), alterando só `groupsIgnore`. Não é acionada automaticamente.

## Confirmação automática ou manual
- `salons.auto_confirm_appointments` (padrão **manual**; salões existentes normalizados para manual, que já era o comportamento real). Trigger `appointments_auto_confirm` (BEFORE INSERT, roda antes de `whatsapp_validate_appointment`, então a checagem de horário continua valendo) confirma na hora pedidos do link público, BookingFlow e WhatsApp; agendamento criado pelo dono no painel fica como ele escolheu.
- Mensagens: automático = uma mensagem "Seu agendamento está confirmado ✅"; manual = "aguarda confirmação" e, quando o dono confirma, "confirmado". Push ao dono: "Agendamento aguardando sua confirmação" ou "Novo agendamento confirmado".
- Painel: Configurações → cartão do link público → Confirmação dos agendamentos. Agenda e Dashboard mostram "Aguardando sua confirmação (N)" com Confirmar/Recusar (também em lote).

## Automações
- Lembretes: `reminder_minutes` aceita 15 e 30. O padrão `{1440,120,30,15}` vale só para salões novos. O cron `whatsapp-reminders-minute` roda a cada minuto.
- Avaliação: o trigger dispara quando o agendamento vira `completed` com `review_enabled`. O pedido sai 1 h depois, uma vez por agendamento, com nota por lista (`rate.N`) ou número e comentário opcional. A gravação vai para `reviews`, igual a `/avaliar/:id`.
- Aniversário: roda a partir das 9 h no fuso do salão, uma vez por ano. Respeita `marketing_opt_out` e a supressão. O cupom individual de uso único só é criado com `birthday_coupon_enabled`.

## Consumo de IA
As respostas determinísticas (menus, votos, nota, comprovante, PIX) saem com `provider: "deterministic"`. O `whatsapp-inbound-worker` grava `ai_log_reply(with_ai=false)` para elas. O ponto único é `recordDeterministic()` em `chatbot.ts`.
