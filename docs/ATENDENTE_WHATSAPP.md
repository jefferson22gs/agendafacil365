# Atendente WhatsApp

O link público do salão também funciona por conversa no WhatsApp: a IA conversa e, para agendar, abre um fluxo de menus que roda **sem IA**.

## Fluxo
1. A pessoa pede para agendar. A IA chama `start_booking`, e o servidor manda o primeiro menu.
2. Os menus seguem esta ordem: serviço (preço e duração do cadastro), profissional ou "Qualquer profissional", dias com horário livre (21 dias), horários livres (`get_available_time_slots`).
3. Cadastro: nome completo, se o WhatsApp da conversa é o do cadastro (ou outro número, normalizado para E.164) e data de nascimento (opcional; aceita `pular`). Se o cliente já existe pelo `phone_normalized`, os dados que ele já tem não são pedidos de novo.
4. Cupom (opcional), validado no servidor por `whatsapp_coupon_eval` com as mesmas regras do link público.
5. Resumo, depois **Confirmar** (clique ou `CONFIRMAR`). Em seguida roda `whatsapp_book_appointment_v2`, que é transacional, idempotente por `request_key` e respeita `chatbot_booking_enabled`.
6. Com `salons.pix_key` e valor > 0, o cliente escolhe entre **Pagar agora (PIX)** e **Pagar no salão**. Se escolher PIX, recebe o QR (PNG), o copia e cola em mensagem separada e o pedido de comprovante.
7. O comprovante (foto/PDF ≤ 5 MB) vai para `appointment_payment_proofs` e para o bucket privado `payment-proofs`. O dono recebe uma notificação. A resposta ao cliente é "Recebi seu comprovante. A equipe do salão vai conferir." O sistema **nunca** diz que o pagamento foi confirmado.

## Menus clicáveis
- `sendList` / `sendButtons` da Evolution 2.3.7. O corpo segue `SendListDto` / `SendButtonsDto` em `src/api/dto/sendMessage.dto.ts`, conferido no código-fonte oficial da tag 2.3.7.
- Limites: 10 linhas por lista, títulos com até 24 caracteres, descrições com até 72. A paginação aparece como "Ver mais opções".
- Os ids das linhas têm o formato `<nonce>.<n>`. O valor real fica no servidor (`pending_action`), e id de menu antigo é ignorado.
- Fallback: o `text_content` do outbox sempre leva a versão numerada. Se a Evolution recusar o interativo antes do envio, sai o texto. Respostas como "2", "opção 2" e "2️⃣" são aceitas. Para desligar, use `whatsapp_automation_settings.interactive_enabled`.

## Automações
- Lembretes: `reminder_minutes` aceita 15 e 30. O padrão `{1440,120,30,15}` vale só para salões novos. O cron `whatsapp-reminders-minute` roda a cada minuto.
- Avaliação: o trigger dispara quando o agendamento vira `completed` com `review_enabled`. O pedido sai 1 h depois, uma vez por agendamento, com nota por lista (`rate.N`) ou número e comentário opcional. A gravação vai para `reviews`, igual a `/avaliar/:id`.
- Aniversário: roda a partir das 9 h no fuso do salão, uma vez por ano. Respeita `marketing_opt_out` e a supressão. O cupom individual de uso único só é criado com `birthday_coupon_enabled`.

## Consumo de IA
As respostas determinísticas (menus, nota, comprovante, PIX) saem com `provider: "deterministic"`. O `whatsapp-inbound-worker` grava `ai_log_reply(with_ai=false)` para elas. O ponto único é `recordDeterministic()` em `chatbot.ts`.
