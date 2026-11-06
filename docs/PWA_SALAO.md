# App próprio por salão (PWA) e push

## Como funciona
- `/s/:slug` troca o head enquanto aberta (`src/components/pwa/useSalonHead.ts`): manifest `/api/manifest/:slug`, theme-color, título, `apple-touch-icon`, `apple-mobile-web-app-title`, status-bar. Tudo é restaurado ao sair.
- Manifest (`api/manifest/[slug].ts`): `id` = `/s/:slug` (estável), `start_url` = `/s/:slug?source=pwa`, `scope` = `/s/:slug` (página, fluxo de agendamento e `/s/:slug/:profissional`). `/appointment/:token` e `/avaliar/:id` ficam fora do scope: abrem no navegador, sem quebrar.
  Nome/cores: `pwa_*` > nome/`primary_color` > padrão; só HEX válido. `pwa_enabled=false` → 404 (sem app).
- Ícone (`api/icon/[slug].ts`): **SVG** (`sizes: any`, `any` e `maskable` com safe zone de 80%). Motivo: sem dependências novas não dá para compor PNG no servidor. O logo só entra se for imagem do Storage público do projeto (`https://ocbwsaydgkiseeardjga.supabase.co/storage/v1/object/public/...png|jpg|webp`), baixado sem redirect, ≤ 400 KB, tipo conferido, embutido como data URI (SVG em `<img>` não carrega URL externa). Qualquer outra URL: inicial do nome na cor do salão. **Sem SSRF.** PNG da plataforma continua no manifest como fallback (iOS ignora SVG); o `apple-touch-icon` usa o logo do Storage, senão o PNG padrão.
- Página pública: `SalonAppCard` (único; substitui SalonInstallPrompt/NotificationPrompt em `/s/*`). Instalar via `beforeinstallprompt`; iOS mostra o passo a passo do Safari. Notificações: estados sem suporte, negado (como reativar), iOS fora do app instalado (iOS 16.4+ só no app da Tela de Início), já instalado, já inscrito. Dispensa por salão em `localStorage`. Demo: só visual.
- Painel: Configurações > **Meu aplicativo** (`MyAppCard`) e **Notificações Push** (dono ativa no próprio aparelho; teste real só para os aparelhos do dono).

## Segurança do push
- `push_subscriptions`: sem escrita direta. Registro/remoção/status só pelas RPCs `register_push_subscription`, `unregister_push_subscription`, `push_subscription_status` (exigem o token do próprio aparelho). Dono lê só o próprio salão e **sem a coluna `fcm_token`**; super admin lê tudo.
- `send-push-fcm` (e alias `send-push`): JWT do dono/admin do salão ou chave secreta do projeto. Público: `owner` (aparelhos do dono), `clients` (client_ids do salão; lista vazia = ninguém), `subscribers` (inscritos do salão, sem o dono). Mensagem só `data`; o SW monta título/ícone do salão; link só relativo do mesmo site.
- Novo agendamento: trigger → `push_outbox` → cron `push-outbox-worker` → `send-push-notification` (só chave do servidor) → aparelhos do dono. O navegador do cliente não dispara push.
- Sem `FIREBASE_PRIVATE_KEY`: resposta `503 push_not_configured`; a UI mostra "As notificações ainda não foram ativadas pela plataforma". A fila fica pendente e expira em 24 h.

## Para ligar em produção
1. Firebase Console (`belezatech-infinite`) > Configurações > Contas de serviço > Gerar nova chave privada. Gravar o `private_key` do JSON como segredo `FIREBASE_PRIVATE_KEY` das Edge Functions (com `\n` literais ou quebras reais). Se a conta não for `firebase-adminsdk-fbsvc@belezatech-infinite.iam.gserviceaccount.com`, gravar também `FIREBASE_CLIENT_EMAIL`.
2. Confirmar Cloud Messaging API (V1) ativa no projeto Google Cloud e que o par VAPID de `src/lib/firebase.ts` é o do projeto.
3. Restrições da API key web (Google Cloud > Credenciais): permitir `agendafacil365.com.br`, `www.agendafacil365.com.br` (e o domínio Vercel de preview se usado). Firebase Authentication não é usado.
4. Aplicar a migração `20261106001000_pwa_push_security.sql`; publicar `send-push-fcm`, `send-push`, `send-push-notification` com `--no-verify-jwt` (validam internamente).
5. Vercel: `SUPABASE_URL` e `SUPABASE_ANON_KEY` (já usadas pelo manifest) valem para `/api/icon`.
