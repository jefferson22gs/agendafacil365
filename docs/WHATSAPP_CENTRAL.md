# Central WhatsApp (`/admin/whatsapp`)

Abas: `?aba=conversas|disparador|status|chatbot|contatos|conexao` (`contatos=importar|exportar`). Rotas antigas
(`/admin/broadcast`, `/status-scheduler`, `/chatbot`, `/import-contacts`, `/export-contacts`) redirecionam para a aba.

## Fluxo de mensagens
- Recebida: Evolution → `evolution-webhook` → `whatsapp_messages` (inbox) + `whatsapp_webhook_events` → `whatsapp-inbound-worker` → chatbot → `whatsapp_outbox`.
- Enviada pela fila (IA, lembretes, campanhas): trigger `whatsapp_outbox_to_inbox` grava em `whatsapp_messages` (autor `ai`/`system`).
- Enviada pelo celular: webhook `MESSAGES_UPSERT` com `fromMe` (autor `human`, origem `phone`).
- Resposta pelo sistema: `whatsapp-reply` (JWT do dono/admin) envia via Evolution, grava autor `human` com `client_ref` idempotente e assume a conversa (`human_takeover`).
- Mensagem tem `kind` (`text|interactive|media`), `message_type` (image, list, list_reply…) e `payload` jsonb opcional
  (ex.: `{ "options": ["Corte", "Escova"] }` é exibido como lista numerada).

## Evolution (v2)
Eventos do webhook: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`.
`whatsapp-instances` reconfigura isso ao conectar; instâncias já conectadas: ação `sync_webhook` (ou reconectar).

## Disparador
Fontes: clientes, contatos da Evolution (`findContacts` + `findChats`), CSV/VCF, manual. Normaliza para E.164
(celular BR antigo ganha o 9º dígito; fixo não; sem DDD é rejeitado), deduplica, ignora grupos/listas/canais/@lid e
opt-out. Lotes de 1.000 com `submissionId` estável (reenvio não duplica). Fila: 1 msg/3 s por instância; status por
destinatário em `broadcast_messages`.
