# Rebranding SysHair / BelezaTech → Agenda Fácil 365

Branch local `feat/agenda-facil-365-rebrand`. Commit de baseline: `2fb2181`, um snapshot que criei porque a pasta não era repositório git. Não há remote configurado e nada foi publicado.

## Decisões

### Raiz efetiva
O checkout tem duas raízes: `syshair-main/` (externa) e `syshair-main/syshair-main/` (interna). A **externa** é a efetiva. Só ela tem `scripts/training-check.cjs`, `tests/`, `docs/`, `vite.config.training.ts`, `src/features/training` e os scripts `training:*` e `test` no `package.json`. A interna **não foi editada nem apagada**. A Root Directory do Vercel ainda precisa ser confirmada (ver `DEPLOY_AGENDA_FACIL_365.md`).

### Gerenciador
npm (`package-lock.json`, `npm ci`). `bun.lockb` foi mantido sem uso. Nenhuma dependência foi adicionada ou atualizada.

### Fonte da marca
- `src/config/brand.ts` reúne nome, nome curto, id `agenda-facil-365`, descrição, caminhos de assets, cores, `DEFAULT_TENANT_COLOR`, `safeHexColor()`, `displayPlanName()` e `publicOrigin()`.
- Assets aprovados: `rebrand-assets/brand/` (cópia do pacote) → `public/brand/`. Ícones de PWA, favicon, apple-touch e og-image ficam na raiz de `public/`. `icon-192.png` e `icon-512.png` são aliases, porque o código legado os referencia. A prancha `previa-identidade.png` não é usada no app.
- `Logo.tsx` mantém as props `className`, `showText` e `size`. Ganhou `variant` (`default` | `white` | `auto`) e `decorative`. Usa os SVGs oficiais via `<img>`, com proporção preservada e sem texto duplicado. Em `auto` troca para a versão branca no modo escuro. Na sidebar navy usa sempre branco.

### Tokens e tema
- O formato HSL sem wrapper foi mantido (`hsl(var(--x))` no Tailwind). **Claro é o padrão em `:root`; escuro fica em `.dark`.** É a mesma classe do `darkMode: ["class"]` do Tailwind, o que deixa `dark:` coerente com os tokens. A classe legada `.light` foi descontinuada e é removida ao aplicar o tema.
- `text-primary` usa `--primary-text`. No claro é #2563EB (5,2:1 sobre branco). No escuro é #93C5FD, porque o azul oficial não tem contraste para texto pequeno sobre navy. Botões usam `bg-primary` + branco nos dois modos.
- Os tokens `gold`, `gold-light`, `gold-dark`, `shadow-gold`, `pulse-gold`, `.btn-gold`, `.text-gradient-gold`, `.gold-glow` e `.card-gold` foram **removidos sem alias**. Os usos viraram `brand-*`, `shadow-brand`, `text-primary`, `.brand-glow` e `.card-brand`. As variantes de Button `gold` e `gold-outline` viraram `brand` e `brand-outline`.
- Playfair Display foi removida. `font-display` virou alias de Inter, para não quebrar as classes existentes. O fallback é system-ui.
- Sem flash de tema: um script inline no `index.html` aplica `.dark` antes do primeiro paint.
- `ThemeSelector`: as chaves novas são `agenda-facil-365-mode` e `agenda-facil-365-palette`. A migração das chaves legadas é idempotente (`src/lib/themePreferences.ts`) e nunca apaga storage. O antigo padrão `gold` vira azul. Paletas opcionais (rosa, esmeralda, violeta, coral) foram recalibradas para texto branco com contraste de pelo menos 4,5:1. A paleta só vale com o layout administrativo montado (é limpa no unmount) e não vaza para páginas públicas.

### PWA, workers e manifest
- O manifest do app mantém `id`/`start_url`/`scope` = `/`, ou seja, é o mesmo app já instalado. Nome, ícones, maskable próprio e cores são os novos. Os screenshots inexistentes saíram do manifest. As splash e o `safari-pinned-tab` inexistentes saíram do `index.html`.
- **Um worker por scope.** Antes, três arquivos (`/sw.js` do Workbox, `/sw-push.js` e `/firebase-messaging-sw.js`) eram registrados em `/` e se substituíam conforme a tela visitada. Agora o `dist/sw.js` gerado faz `importScripts('firebase-messaging-sw.js')`, e o app registra sempre `/sw.js` em produção (`src/lib/serviceWorker.ts`). Em dev, onde o VitePWA não gera worker, usa os arquivos de push.
  - Limitação registrada: o fallback do `sw-push.js` que buscava a "última notificação" via REST não entrou no worker unificado, porque duplicaria o listener `push` do FCM. O envio server-side real é por FCM (`send-push`, `send-push-fcm`). O `send-push-notification` (Web Push VAPID) tem envio marcado como TODO no código.
  - `public/sw.js` legado nunca era servido em produção: o build sobrescreve o caminho com o worker do Workbox.
- O precache exclui os workers de push e os PNGs grandes de `public/brand`. `navigateFallbackDenylist: [/^\/api\//]`.
- Manifest por tenant: `src/pages/api/manifest/[slug].ts` (formato Next.js, nunca servido pela SPA Vite) foi **substituído** por `api/manifest/[slug].ts`, uma Vercel Function. Ela valida o slug, usa só a chave anon server-side e as colunas públicas (`name, slug, primary_color`), filtra `is_active`, retorna 404 controlado e tem cache por tenant. Usa ícones próprios da plataforma (o logo do cliente não garante tamanho, MIME nem safe zone) e `id` distinto (`/s/:slug`). O `vercel.json` não reescreve mais `/api/*`.

### Multi-tenant
O prompt de instalação usava `salon.theme_color`, mas esse campo nunca era carregado (não existe no tipo `Salon` nem nas queries). Na prática, o prompt saía sempre dourado. Agora usa `primary_color` do tenant, validado. Nada de schema foi renomeado. Cores e logos salvos não foram alterados. O azul entra só como fallback de valor ausente ou inválido (`safeHexColor`, que aceita apenas HEX). As páginas públicas restauram título, manifest e theme-color ao desmontar (detalhes no relatório de validação).

### Conteúdo
- Alegações não verificadas (contagem de clientes, % de faltas e faturamento, depoimentos, parceiros) foram **removidas** da experiência pública, sem substitutos inventados. A lista está em `REBRANDING_VALIDATION.md`, seção "Pendências comerciais".
- Preços, planos, trial e limites não foram alterados.
- `plan_name` persistido continua `SysHair Premium`. Só a exibição foi traduzida (`displayPlanName`).
- Chatbot: o código de verificação aceita os prefixos legado e novo.

### Componentes e rotas órfãs (não removidos)
- `src/pages/Booking.tsx` e `src/pages/AppointmentConfirmation.tsx`: não são importados em lugar nenhum.
- `src/components/admin/ReferralProgram.tsx`: não é importado. O usado é `RealReferralProgram`. Ambos geram link `/ref/:code`, mas **essa rota não existe em `App.tsx`**. Não inventei rota: o link legado com domínio fixo `syshair.app` virou origem atual, e a pendência ficou registrada.
- `src/components/ui/theme-toggle.tsx` (next-themes): não é usado.
- `src/pages/Dashboard.tsx`: é importado em `App.tsx` mas não está ligado a nenhuma rota (`/dashboard` redireciona para `/admin`).

### Segurança (só natureza e caminho, sem valores)
- `public/sw-push.js` tem URL do Supabase e JWT `anon` em texto. É chave pública, mas está duplicada fora do `.env`. Preexistente.
- `src/lib/firebase.ts` e `public/firebase-messaging-sw.js` têm a config web do Firebase. É pública por design. Preexistente.
- `src/services/mercadoPagoWebhook.ts` lê `process.env.SUPABASE_SERVICE_ROLE_KEY` dentro de `src/`. Não é importado pelo app, então não entra no bundle, mas um import futuro vazaria a intenção. Recomendo mover para Function.
- `.env.example` lista `VITE_EVOLUTION_API_KEY`, mas **nenhum código em `src/` lê essa variável**. A Evolution é usada só em Functions (`EVOLUTION_API_KEY` server-side). Recomendo remover a linha do `.env.example` e verificar se o painel do Vercel tem essa variável definida. Se tiver, ela entra no bundle de qualquer build que a referencie. A rotação fica com o responsável.
