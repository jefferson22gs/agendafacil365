# Plano de implantação: Agenda Fácil 365

Esta etapa **não inclui deploy**. Não foi feito push, deploy, mudança no Vercel/DNS nem migração remota. Este é o plano para uma aprovação futura.

## 1. Quatro mudanças independentes

| Mudança | Depende de | Observação |
|---|---|---|
| A. Código do rebranding (este branch) | nada | Pode ir para um preview sem trocar o domínio. |
| B. Nome do projeto no Vercel | A | É só cosmético. Não migra domínio, variáveis nem integrações. |
| C. Domínio público novo | decisão comercial + DNS | Ainda **não definido**. Muda origem, sessão, push e PWA instalado (ver seção 6). |
| D. Backend externo (Supabase Functions, Firebase, Mercado Pago, Evolution) | A | O deploy do Vercel **não** atualiza Functions. Elas exigem deploy próprio. |

## 1.1 Antes de qualquer push ou deploy (bloqueios da auditoria de 05/11/2026)

1. **Dados pessoais no histórico git:** `vcards_20260131_134801.vcf` (2.131 contatos) saiu do índice, mas continua nos commits locais `2fb2181` e `354ea50`. Antes de enviar a qualquer remoto, recrie o histórico sem o arquivo (ex.: `git filter-repo --path vcards_20260131_134801.vcf --path syshair-main/vcards_20260131_134801.vcf --invert-paths`) ou crie um repositório novo a partir da árvore atual. Decisão e execução ficam com o responsável.
2. **Segurança de assinatura (crítico):** revise `supabase/pending/20261105000100_security_subscriptions_notifications_rls.sql` e aplique primeiro em staging, com backup. Depois, aplique em produção **antes** de divulgar o domínio novo. O app funciona antes e depois da migração (fallback só quando a RPC não existe).
3. **Function `mercadopago-webhook`** foi alterada (busca por `.eq()`): deploy próprio com `supabase functions deploy mercadopago-webhook`, validado com o sandbox do MP.

## 2. Configuração do Vercel (confirmar no painel)

- **Root Directory**: precisa ser a raiz externa `syshair-main/` (tem `scripts/`, `tests/`, `docs/`, `vite.config.training.ts` e treinamento). A cópia interna `syshair-main/syshair-main/` está desatualizada. Confirme qual delas o projeto usa hoje **antes** do deploy.
- Framework: **Vite**. Build: `npm run build`. Output: `dist`. Install: `npm ci` (usar `package-lock.json`; ignorar `bun.lockb`).
- `vercel.json`: o rewrite SPA virou `/((?!api/).*)` → `/`. Assim, `/api/*` chega às Functions em vez de devolver HTML.
- Function nova: `api/manifest/[slug].ts` (runtime Node, `export function GET(Request)`). Valide no preview: `GET /api/manifest/<slug-real>` precisa retornar `200`, `application/manifest+json` e JSON. Slug inexistente precisa retornar `404` em JSON.

## 3. Variáveis de ambiente (só nomes)

| Nome | Escopo | Uso |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | build (público) | Cliente do app. Já existem. |
| `VITE_SUPABASE_ANON_KEY` | build (público) | Já é usada no código. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | **server** (Function de manifest) | Novas. Usam a chave anon, não a service-role, e respeitam a RLS "Public can read active salons by slug". |
| Preview × Production | separados | Use o mesmo projeto Supabase só se for intencional. Não aponte o preview para dados de produção sem decisão. |

Nunca coloque service-role, chave da Evolution ou segredo de webhook em `VITE_*`.

## 4. Supabase Functions afetadas (deploy próprio, fora do Vercel)

Só mudaram textos visíveis. Infraestrutura, nomes de instância e cabeçalhos ficaram iguais.

- `_shared/whatsapp/chatbot.ts` (texto + `parseVerificationCode` com prefixo legado), usado por `whatsapp-chatbot`, `whatsapp-inbound-worker`, `evolution-webhook`
- `_shared/insights/service.ts`, `_shared/insights/core.ts` (texto), usados por `insights-reports` e pelo chatbot
- `insights-reports/index.ts` (texto do código de verificação)
- `super-admin-actions/index.ts` (títulos padrão de aviso/comunicado)
- `mercadopago-webhook/index.ts` (auditoria: localização da assinatura sem filtro interpolado)

Comando de referência para depois da aprovação, sem executar agora: `supabase functions deploy <nome> --project-ref <ref>`, uma function por vez, começando em staging se houver.

## 5. Validação no preview antes da produção

1. Redirect de auth do Supabase: incluir a URL de preview em *Redirect URLs*.
2. Firebase: incluir o domínio de preview em *Authorized domains*. Testar FCM: permissão, token, push em segundo plano e clique.
3. CORS das Functions, se houver allowlist de origem.
4. Webhooks Mercado Pago e Evolution: continuam apontando para as Functions do Supabase (sem mudança). Validar só com sandbox.
5. Links compartilhados `/s/:slug`, `/agendar/:slug`, `/appointment/:token`, `/avaliar/:id`, `/waitlist/:id` e QR de check-in.
6. Service worker: o worker do build (`/sw.js`, Workbox) agora importa `firebase-messaging-sw.js`. App e push passam a usar um registro só no scope `/`. Testar com o PWA instalado na versão anterior: precisa atualizar sem perder sessão e sem descartar push subscriptions. Testar também com um formulário preenchido durante a atualização.
7. Manifest genérico (`/manifest.webmanifest`) e por tenant. Sair de `/s/:slug` precisa restaurar manifest, título e theme-color.
8. SEO/OG: `og:url` absoluto fica pendente até definir o domínio.

## 6. Mudança de domínio (C): o que não migra sozinho

- Sessão (localStorage por origem): os usuários precisam entrar de novo.
- Permissão de notificação e push subscriptions/tokens FCM são por origem: será preciso pedir de novo.
- PWA instalado é por origem: será preciso instalar de novo.
- Preferências locais (tema, tour) não são copiadas.

Planeje redirect 301 do domínio antigo e mantenha o antigo ativo durante a transição. Não prometa migração automática.

## 7. Rollback

- Código: voltar o Vercel ao deployment anterior (Instant Rollback) ou fazer deploy do commit `baseline` (`2fb2181` no repositório local).
- Workers: o rollback volta o `/sw.js` anterior. As subscriptions não são apagadas, e as chaves novas de storage são só aditivas.
- Functions: refazer o deploy da versão anterior de cada function alterada (guarde o hash antes).
- Variáveis: o responsável restaura no painel.
- Dados: nenhuma migração de dados foi feita, então não há nada a desfazer. Não apague dados nem desfaça migrations de forma indiscriminada.
