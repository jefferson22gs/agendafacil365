# Validação do rebranding: Agenda Fácil 365 (Fase A, local)

Data: 04/11/2026. Raiz: `J:\AREA DE TRABALHO\Projetos\SysHair\syshair-main` (externa). Branch local `feat/agenda-facil-365-rebrand`. Baseline: `2fb2181`.
Nada foi publicado. Não houve acesso ao Supabase, Vercel, Mercado Pago, Evolution, Firebase nem a dados reais.

Status usados: **VALIDADO** (observado), **BLOQUEADO** (depende de algo externo), **NÃO APLICÁVEL**.

## 1. Comandos (baseline → depois)

| Comando | Baseline | Depois | Observação |
|---|---|---|---|
| `npm ci` | OK | — | npm 10.9.2, Node 22.17.1 |
| `npm run build` | OK | OK | O aviso de chunk acima de 500 kB já existia. PWA generateSW com 105 entradas. |
| `npm run lint` | 415 erros / 158 avisos | 414 erros / 158 avisos | Já falhava. Nenhuma regra foi desativada. |
| `tsc --noEmit -p tsconfig.app.json` | 251 erros | 249 erros | Já falhava (tipos Supabase desatualizados: `waitlist`, `sellers` etc.). Nenhum erro novo. |
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
