# Notificações push (Web Push padrão, sem Firebase)

## Como funciona
- **Navegador**: `src/lib/webPush.ts` cria a inscrição com `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID público })`
  no service worker único `/sw.js` (scope `/`, Workbox importa `public/push-sw.js`). A permissão só é pedida num clique.
  Registro por salão via RPC `register_web_push(slug, endpoint, p256dh, auth)`. O mesmo aparelho pode estar inscrito em vários
  salões (mesma inscrição do navegador, uma linha por salão).
- **Servidor**: triggers enfileiram em `push_outbox` (idempotente por `dedupe_key`, liga/desliga em `push_preferences`).
  O worker `send-push-notification` (cron 1/min + chamada imediata coalescida a cada 15 s) envia em lote com
  `_shared/push/webpush.ts`: VAPID ES256 (RFC 8292) e payload cifrado aes128gcm (RFC 8291), só WebCrypto.
  404/410 desativam a inscrição; 429/5xx tentam de novo com backoff (1, 2, 4, 8, 16 min); vencido expira (lembrete nunca sai atrasado).
- **Eventos**: dono/admins recebem novo agendamento, cancelamento e remarcação feitos pelo cliente, mensagem no WhatsApp em
  atendimento humano (1 aviso a cada 10 min por conversa), assistente pedindo ajuda, comprovante PIX e nova avaliação.
  Clientes (aparelho vinculado ao agendamento pelo `cancellation_token` do link) recebem lembrete, confirmação/remarcação/cancelamento
  feitos pelo salão e pedido de avaliação 1 h depois de concluído. Campanhas (Marketing) vão para inscritos do salão
  que não desligaram as promoções, no máximo 3 por dia.
- **Privacidade**: endpoint e chaves nunca são legíveis pelo navegador (privilégio por coluna); nenhum log contém endpoint,
  chave ou texto. Anônimo só registra/remove o próprio aparelho e não dispara envio.

## Configuração
Nada a configurar no Firebase. As chaves VAPID já estão nos segredos das Edge Functions:
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (escalar `d`, base64url) e `VAPID_SUBJECT`. A pública também está em `src/lib/webPush.ts`
e precisa ser a MESMA do segredo (se trocar o par, troque os dois e todos os aparelhos precisarão se reinscrever).

Publicar: migração `supabase/migrations/20261109000200_web_push.sql` e as funções `send-push-notification`, `send-push-fcm`, `send-push`.

## Migração dos aparelhos antigos (Firebase)
As inscrições antigas (tokens FCM) ficam inativas com motivo `fcm_legacy` (nada é apagado). Quando o aparelho abre o painel ou o
link do salão com a permissão já concedida, o app lê o token antigo guardado pelo SDK, descobre os salões dele
(`push_legacy_salons`) e se reinscreve via Web Push sem novo pedido. No Safari/iOS, se o navegador exigir um toque, o cartão
do salão mostra de novo "Ativar notificações".

## Como validar
1. Rode o ensaio SQL: `BEGIN; \i tests/rebrand/push-full.sql ROLLBACK;` (deve terminar com o NOTICE "todos os cenários passaram").
2. No celular ou computador do dono: Configurações → Notificações Push → **Ativar** → **Enviar teste para meu celular**.
   Esperado: notificação "Notificação de teste"; o histórico mostra "Teste · Enviado (1 ok)". No iPhone, antes adicione o painel
   à Tela de Início pelo Safari e abra pelo ícone.
3. Faça um agendamento pelo link público em outro aparelho, toque em "Receber lembrete neste aparelho" na tela de sucesso.
   O dono recebe "Novo agendamento" em segundos; confirme no painel e o aparelho do cliente recebe "Horário confirmado".
4. Super admin → aba Salões → cartão **Notificações push**: "Funcionando", último envio ok, falha 24 h e inválidos removidos.

Se o teste responder "As notificações ainda não foram ativadas pela plataforma", faltam os segredos VAPID na função.
Se o histórico mostrar falhas com o super admin indicando `vapid_rejected`, a chave pública do código não corresponde à privada.
