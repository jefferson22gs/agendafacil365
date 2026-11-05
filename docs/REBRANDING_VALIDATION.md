# Validação do rebranding: Agenda Fácil 365 (Fase A, local)

Data: 04/11/2026. Raiz: `J:\AREA DE TRABALHO\Projetos\SysHair\syshair-main` (externa). Branch local `feat/agenda-facil-365-rebrand`. Baseline: `2fb2181`.
Nada foi publicado. Não houve acesso ao Supabase, Vercel, Mercado Pago, Evolution, Firebase nem a dados reais.

Status usados: **VALIDADO** (observado), **BLOQUEADO** (depende de algo externo), **NÃO APLICÁVEL**.

## 1. Comandos (baseline → depois)

| Comando | Baseline | Depois | Observação |
|---|---|---|---|
| `npm ci` | OK | — | npm 10.9.2, Node 22.17.1 |
| `npm run build` | OK | OK | O aviso de chunk acima de 500 kB já existia. PWA generateSW com 105 entradas. |
| `npm run lint` | 415 erros / 158 avisos | ver seção 7 (auditoria) | Já falhava. Nenhuma regra foi desativada. |
| `tsc --noEmit -p tsconfig.app.json` | 251 erros | ver seção 7 (auditoria) | Já falhava (tipos Supabase desatualizados: `waitlist`, `sellers` etc.). **Correção:** a versão anterior deste documento dizia "nenhum erro novo" comparando só o total; a comparação por erro mostrou 1 regressão (import ausente em `usePushNotifications.tsx`), corrigida na auditoria. |
| `tsc --strict` em `api/manifest/[slug].ts` | — | 0 erros | Function nova. |
| `npm run training:check` | OK | OK | 40 tours / 50 artigos. Todos os alvos `data-tour` existem. |
| `node --test tests/whatsapp/*.test.cjs` | 46/46 | 46/46 | |
| `npm test` (novo: whatsapp + rebrand) | — | 51/51 | `tests/rebrand/rebrand.test.cjs`: migração de tema, cor de tenant, contratos legados, prefixo de código do chatbot, manifest por tenant (400/404/500/200, MIME, cor e escopo da query). |

## 2. QA em navegador (Chrome headless + playwright-core do cache local, sem dependência nova no repo)

Ambientes:
- `vite preview` do build de produção, sem `.env`: usado para assets, MIME, manifest e SW.
- `npm run training:demo`: Supabase mockado com fixtures fictícias, CSP bloqueando qualquer rede externa. Usado para landing, checkout e todas as telas administrativas logadas.
- `vite` dev com URL de Supabase fictícia `.invalid`: usado para as telas deslogadas e públicas por slug ou token.

Resultado: **670/670 checagens VALIDADAS** no script principal e **19/19** no script das telas deslogadas. Screenshots com dados fictícios em `%TEMP%\af365-qa\out\` (fora do repo).

| Verificação | Status | Evidência |
|---|---|---|
| Rotas públicas `/`, `/login`, `/register`, `/install`, `/checkout` (3 variações de `?plano`), `/booking`, `/agendar` e 404 em 360/390/768/1024/1440 | VALIDADO | Sem rolagem horizontal, sem marca antiga, sem `href="#"`, toda `<img>` com alt, assets sem 4xx/5xx |
| 24 rotas `/admin/*` em 360 e 1440, claro e escuro | VALIDADO | Layout renderizado, título correto, sem rolagem horizontal, sem marca antiga, sem erro JS |
| `/s/:slug`, `/appointment/:token`, `/login`, `/register`, `/install` deslogados, em claro e escuro | VALIDADO | Sem overflow, sem erro JS, sem marca antiga. Sem backend, as telas mostram estado de erro ou carregamento. |
| Tenant → plataforma: título, manifest e theme-color restaurados | VALIDADO | `/manifest.webmanifest` → `/api/manifest/studio-demo` → `/manifest.webmanifest`; theme `#2563EB` restaurado |
| Paleta opcional do admin não vaza para página pública | VALIDADO | Admin `--primary=161 94% 26%`; ao ir para `/` fica vazio |
| Modo escuro legado (`syshair-mode=dark`) aplicado antes do React (sem flash) | VALIDADO | `.dark` presente em `domcontentloaded` |
| Drawer mobile: `aria-expanded`, foco interno, Esc, retorno de foco | VALIDADO | `/admin` @390 |
| Menu mobile da landing: `aria-expanded` + Esc | VALIDADO | `true -> false` |
| Âncoras da landing existem no DOM | VALIDADO | `#features #pricing #about #contact #how-it-works #faq` |
| CTA de plano preserva a escolha | VALIDADO | `/checkout?plano=mensal`/`anual`; `?plano=anual` mostra R$ 400,00; `?plano=xyz` cai no mensal R$ 39,90 |
| WhatsApp da landing usa o número real de `contact.ts` | VALIDADO | Sem placeholder `5511999999999` |
| Tour "Conheça o Agenda Fácil 365" abre e mostra o passo 1/11 no layout novo | VALIDADO | `tour_overview_1440.png` |
| Manifest, ícones, favicon, apple-touch, maskable, og-image, logos SVG, robots, sitemap, `sw.js`, `firebase-messaging-sw.js`, `icon-192.png` | VALIDADO | 200 com MIME correto no preview |
| Um único service worker ativo (`/sw.js`), com `importScripts('firebase-messaging-sw.js')` no build | VALIDADO | 1 registro; o `dist/sw.js` contém o import |
| Zoom 200% | BLOQUEADO | Não automatizado. Equivale a cerca de 720px CSS em 1440: coberto parcialmente pelos testes em 768. |
| Leitor de tela real (NVDA/VoiceOver) | BLOQUEADO | Não disponível no ambiente |
| Contraste: pares de tokens | VALIDADO (cálculo) | #2563EB/branco 5,2:1; #14213D/#F4F8FF > 14:1; #475569/#FFF 7,6:1; #93C5FD/#14213D 8,6:1; #B91C1C/#FFF 6,5:1; #15803D/#FFF 5,0:1; #B45309/#FFF 5,0:1 |

## 3. Matriz de rotas (`src/App.tsx`, 44 rotas)

Legenda das colunas: A = acesso, M = mudança, V = verificação.

| Rota | Componente | A | M | V |
|---|---|---|---|---|
| `/` | Index (landing) | público | redesign + conteúdo honesto | VALIDADO (5 larguras, âncoras, CTAs) |
| `/login` | Login | público | redesign, painel navy | VALIDADO (UI). Login real BLOQUEADO (sem Supabase de teste) |
| `/register` | Register | público | redesign, depoimento removido | VALIDADO (UI). Cadastro real BLOQUEADO |
| `/install` | Install | público | marca e ícone novos | VALIDADO |
| `/booking`, `/booking/:salonId` | BookingFlow | público | tenant no cabeçalho, "Tecnologia Agenda Fácil 365" | VALIDADO (UI sem dados). Fluxo real BLOQUEADO |
| `/s/:slug` | PublicSalon | público | sem SW manual, restaura metadados, cor validada | VALIDADO (UI + restauração). Dados reais BLOQUEADO |
| `/s/:salonSlug/:professionalSlug` | PublicProfessional | público | fallback de cor | BLOQUEADO (sem dados) |
| `/appointment/:token` | ManageAppointment | público por token | cor do tenant validada | VALIDADO (UI). Cancelar/reagendar BLOQUEADO |
| `/checkout` | Checkout | público | `?plano=`, `postMessage` só com origem MP, sem sucesso forjado | VALIDADO (UI e plano). Pagamento BLOQUEADO (sem sandbox) |
| `/agendar`, `/agendar/:salonSlug` | PublicBookingAdvanced | público | tenant no cabeçalho | VALIDADO (UI sem dados) |
| `/avaliar/:appointmentId` | RatingPage | público | visual | BLOQUEADO (sem dados) |
| `/super-admin` | SuperAdmin | guard interno por e-mail + function server-side | marca, `displayPlanName`; guards intocados | BLOQUEADO (sem conta superadmin de teste) |
| `/waitlist/:salonId` | PublicWaitlist | público | logo do tenant, atribuição discreta | BLOQUEADO (sem dados) |
| `/dashboard` | redirect → `/admin` | ProtectedRoute | — | NÃO APLICÁVEL |
| `/admin` … `/admin/training/:articleId` (25 rotas) | páginas admin | ProtectedRoute | PageHeader, StatCard, badges semânticos, gráficos com tokens | VALIDADO em modo demonstração (24 rotas + artigo via tour); ações com efeito real BLOQUEADO |
| `/professional` | ProfessionalDashboard | ProtectedRoute(professional) | visual | BLOQUEADO (o modo demo autentica só admin) |
| `/profile` | ClientProfile | ProtectedRoute | visual | BLOQUEADO (idem) |
| `*` | NotFound | público | textos e link para "/" | VALIDADO |

Componentes órfãos, preservados e listados em `REBRANDING.md`: `Booking.tsx`, `AppointmentConfirmation.tsx`, `ReferralProgram.tsx`, `theme-toggle.tsx`, e `Dashboard.tsx` (importado, sem rota).

## 4. Multi-tenant

| Item | Status | Evidência |
|---|---|---|
| Cor salva (inclusive dourada) preservada; azul só como fallback | VALIDADO (teste) | `safeHexColor('#D4AF37') === '#D4AF37'`; valores inválidos ou injeção caem em `#2563EB` |
| Nenhum UPDATE ou migração | VALIDADO | Nenhum SQL novo; nenhum comando remoto executado |
| Manifest por tenant usa só colunas públicas, chave anon e filtro por slug | VALIDADO (teste) | `select=name,slug,primary_color&slug=eq.<slug>&is_active=neq.false` |
| A → B → plataforma sem herdar metadados | PARCIAL | Tenant → plataforma VALIDADO. A → B com dados reais BLOQUEADO. |
| Isolamento de queries/cache/realtime | VALIDADO (revisão) | Nenhuma query nova sem escopo. Os filtros novos em Agendamentos atuam sobre dados já carregados. |

## 5. Pendências comerciais e jurídicas (bloqueios de publicação)

1. **Termos de Uso e Política de Privacidade** não existem. Os links `#` foram removidos do Register e do rodapé. Publicar sem esses documentos é decisão jurídica.
2. **Alegações removidas** por falta de evidência:
   - "2.500+ salões"
   - "+50% redução de faltas"
   - "30 seg"
   - "4.9", "50K+/mês", "98% satisfação", "99.9% uptime"
   - "setup em 5 min"
   - "resposta em 1h/2h"
   - cinco depoimentos com nome e foto
   - seis "parceiros" com foto do Unsplash
   - depoimento "Roberto Silva" no Register
   - "Garantia de 30 dias". Removida porque o código não a sustenta; se a garantia for real, basta restaurar a frase.
3. **Vídeo de demonstração**: o placeholder `dQw4w9WgXcQ` foi removido junto com a seção. Aguarda vídeo oficial.
4. **Teste grátis**: 21 dias via `/register` (`startTrial`). O teste no Checkout depende da configuração do plano no Mercado Pago (desconhecida), por isso o texto ficou neutro. `DEFAULT_PLAN.trialDays = 7` em `mercadoPago.ts` (arquivo sem import) diverge e precisa de confirmação.
5. **Recuperação de senha**: não existe fluxo. "Esqueceu a senha?" agora leva ao WhatsApp de suporte real. Implementar reset exige tela nova e Redirect URL no Supabase Auth (fase B).
6. **`/ref/:code`**: a rota não existe. `RealReferralProgram` (em uso) gera links para ela, e esses links quebram. Já era assim.
7. **`Marketing.tsx`**: excluir template não pede confirmação. Já era assim e foi mantido.

## 6. Não foi possível validar nesta etapa

- Login, logout, cadastro e sessão reais; agendamento, cancelamento e reagendamento com dados reais; conflitos de horário; cupom, pacote e fidelidade com dados reais. Não há Supabase de teste.
- Pagamento e assinatura no Mercado Pago (sem sandbox), WhatsApp/Evolution, e-mails e cron jobs.
- Push FCM real (permissão, token, recebimento e clique), instalação do PWA e atualização a partir da versão antiga instalada. Exigem origem HTTPS e projeto Firebase.
- Function `api/manifest/[slug]` em runtime Vercel. Só foi testada por unidade com fetch simulado; `vite preview` não executa Functions.
- Preview de compartilhamento OG no WhatsApp/Facebook. Exige URL pública.
- Papéis profissional, cliente e superadmin no navegador.
- Leitor de tela e zoom 200% manual.

## 7. Auditoria (05/11/2026)

Fiz uma auditoria independente do código e dos fluxos críticos, com um revisor que não teve acesso ao meu raciocínio, além de varreduras e de uma nova rodada de QA no navegador.
**Testes com Supabase fictício ou mock NÃO provam as integrações reais.** Eles provam renderização, navegação e lógica de UI.

### Comandos (baseline `2fb2181` → agora)

A comparação é feita **erro a erro**, não pelo total.

| Comando | Resultado |
|---|---|
| `npm run build` | OK. O `dist/sw.js` contém `importScripts("firebase-messaging-sw.js")`. |
| `tsc --noEmit -p tsconfig.app.json` | 248 erros, **0 novos** em relação ao baseline (diff por arquivo e código de erro). |
| `npm run lint` | **0 erros novos** por arquivo e regra; 2 a menos que o baseline. |
| `npm run training:check` | PASS (40 tours, 50 artigos). |
| `npm test` | **53/53** (46 de WhatsApp + 7 de rebrand e auditoria). |
| QA no navegador (demo mock, preview e dev com Supabase `.invalid`) | 670/670 e telas deslogadas OK. Metadados do tenant restaurados (`restored=true`). |

### Correções feitas nesta auditoria

| # | Problema | Tipo | Correção | Evidência |
|---|---|---|---|---|
| R1 | `usePushNotifications.tsx` usava `registerAppServiceWorker` sem import, gerando ReferenceError em /admin/marketing | **Regressão do rebranding** | Import adicionado | tsc por erro: 0 novos |
| P6 | `importScripts` do gstatic sem proteção: uma falha de rede derrubaria o SW inteiro, sem precache nem modo offline | Risco da arquitetura nova | `try/catch` e bloco condicional; `notificationclick` não depende do Firebase | Simulação com o import falhando: sem exceção |
| P7 | Notificação FCM exibida duas vezes | Preexistente | `onBackgroundMessage` ignora payload com `notification`; listener `push` duplicado removido | Revisão |
| P3 | O manifest blob do `SalonInstallPrompt` sobrescrevia `/api/manifest/:slug` e usava caminhos relativos, inválidos em `blob:` | Preexistente | Não sobrescreve quando a Function está ativa; o fallback usa URLs absolutas e `scope` que contém o `start_url` | QA `restored=true` |
| — | A lista de espera pública `/waitlist/:id` **simulava** a fila: posição sorteada, gravação fingida, aviso que nunca era enviado | Preexistente | A página agora leva à agenda real `/s/:slug` e ao WhatsApp do estabelecimento, sem promessa falsa | `audit_waitlist_demo.png` |
| — | O cross-sell do BI mostrava "% de chance" e ganho **sorteados** (`Math.random`) | Preexistente | Removidos; mostra só a sugestão e o preço real do produto cadastrado | QA: sem "% chance" |
| — | O Lookbook mostrava posts fictícios como se fossem do estabelecimento | Preexistente | Aviso "Demonstração" explícito; botões sem função desabilitados | `audit_lookbook.png` |
| — | O botão de copiar link da Galeria copiava `/gallery/:token`, rota inexistente (404 para o cliente) | Preexistente | O botão avisa que a página pública não existe e não copia URL quebrada | Revisão |
| — | Indicações copiavam `/ref/:code`, rota inexistente (404) | Preexistente | Copia o link público real `/s/:slug` junto com o código | Revisão |
| — | "Cancelar assinatura" executava um `alert()` e não cancelava nada | Preexistente | Explica o processo e abre as assinaturas no Mercado Pago, onde o cancelamento é feito; o status vem do webhook | Revisão |
| — | O `?status=processing` vindo do Checkout era ignorado | Lacuna | Aviso informativo, sem ativar nada | Revisão |
| P1 | O "Nome do negócio" informado no cadastro era descartado | Preexistente | Enviado como metadado do Auth e usado para pré-preencher Configurações | Revisão |
| P2 | `SelectItem value=""` no cadastro (o Radix lança erro ao renderizar) | Latente | Valor sentinela `"none"` | Revisão |
| — | Os toasts (Sonner) usavam `next-themes` sem provider, com tema divergente | Preexistente | Seguem a classe `.dark` real | Revisão |
| P5 | O webhook do MP montava `.or()` com `external_reference` externo e usava uma coluna gravável pelo cliente | Preexistente | Busca só com `.eq()`: por `mp_preapproval_id` ou por `salon_id` (UUID validado) | Teste: injeção rejeitada |
| — | Na Function do manifest, slug com mais de 80 caracteres ou `is_active = null` davam 400/404 | Do rebranding | Limite de 200; `is_active` nulo conta como ativo, igual à RLS pública | Teste |
| — | O arquivo de contatos `vcards_20260131_134801.vcf` (2.131 contatos) estava **versionado** | Preexistente (LGPD) | Removido do índice git (mantido no disco) e `*.vcf` incluído no `.gitignore` | `git status` |
| — | `supabase/config.toml` não tinha o domínio novo nos redirects de Auth | Preparação | `agendafacil365.com.br` e `www.` adicionados (só local; o remoto fica para a fase B) | Arquivo |

### Preparado mas NÃO aplicado (precisa de autorização)

O arquivo `supabase/pending/20261105000100_security_subscriptions_notifications_rls.sql` fica fora de `migrations/` para não ser aplicado por engano.
- **Crítico (P4):** hoje qualquer usuário logado pode rodar, pelo console, `UPDATE subscriptions SET status='active'` na própria linha e usar o sistema sem pagar. A migração remove o INSERT/UPDATE do cliente e cria 3 RPCs `SECURITY DEFINER` restritas: `start_salon_trial`, `expire_own_subscription` e `set_own_payment_reference`.
- **Alto (P8):** a policy `"Anyone can read sent notifications"` expõe as notificações de todos os estabelecimentos à chave anon. A migração remove essa policy.
- O app já chama as RPCs e só volta ao caminho antigo se a função **não existir** (`isMissingRpc`). Se a RPC recusar, o app não usa o caminho antigo (há teste para isso). O rollback está no próprio arquivo.

### Falhas pendentes (não corrigíveis com segurança sem decisão ou acesso)

| Severidade | Item |
|---|---|
| Crítica | Aplicar a migração P4/P8 acima (staging antes de produção, com backup). Até lá, o paywall pode ser contornado. |
| Alta | O histórico git local ainda contém o `.vcf` nos commits `2fb2181` e `354ea50` (repositório local, sem remote). Antes de qualquer push, reescrever o histórico ou recriar o repositório sem o arquivo. Há outra cópia em `syshair-main/` (a cópia interna). |
| Média | O webhook do MP não valida a assinatura `x-signature`. Mitigação: os dados são buscados de novo na API do MP com o token. |
| Média | O cancelamento de assinatura não é feito no servidor; depende de o usuário cancelar no Mercado Pago. |
| Média | `/ref/:code`, `/gallery/:token` e a lista de espera on-line não existem como páginas. As telas agora dizem isso em vez de gerar links quebrados. |
| Baixa | O Lookbook continua com conteúdo de exemplo, agora rotulado. O `OccupancyHeatmap` (gera dados com `Math.random`) não é usado em nenhuma tela. |
| Baixa | Firebase compat 10.7.1 no worker e SDK 12.7.0 na janela. |
| Baixa | A lista de e-mails de super admin está no bundle (`SuperAdmin.tsx`); a autorização real está na RLS e na Function. |
| Jurídico/comercial | Termos, Política de Privacidade, vídeo oficial, garantia de 30 dias, divergência do período de teste (21 × 7 dias). Ver seção 5. |

### Supabase original preservado

Nenhum comando remoto foi executado nesta etapa nem na anterior: nenhum `db push`, `migration up`, `functions deploy` ou `config push`, e nenhum SQL no painel. Nenhuma migração nova foi colocada em `supabase/migrations/`. Sem acesso ao banco não dá para provar a integridade dos dados remotos. O que posso afirmar é que **este trabalho não tocou** no banco, nos usuários, nos tenants nem nos agendamentos.

### Preparação para agendafacil365.com.br

| Item | Estado |
|---|---|
| Links gerados pelo app (`/s/:slug`, `/appointment/:token`, redirect do cadastro) | Usam `window.location.origin` e seguem o domínio automaticamente. Não há domínio antigo fixo em `src/`. |
| Functions do Supabase | Não montam URL com domínio fixo. CORS `*`. |
| Site URL e Redirect URLs do Supabase Auth (remoto) | **Pendente para a fase B** (a config local já inclui o domínio). |
| Domínios autorizados do Firebase e `HTTP-Referer` do OpenRouter | **Pendente para a fase B**. |
| E-mails de autenticação | Os templates ficam no painel do Supabase: **não dá para verificar daqui**. |
| `og:url` e `og:image` absolutos | Prontos via `VITE_PUBLIC_APP_URL` (só em Production). |
| Canonical por rota e sitemap com tenants | Não implementados (é uma SPA). Proposta: pré-renderizar a landing. |
