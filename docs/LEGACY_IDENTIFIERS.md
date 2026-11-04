# Identificadores legados preservados

Após o rebranding para **Agenda Fácil 365**, estes resíduos com o nome antigo (SysHair / BelezaTech) permanecem **de propósito**. São contratos técnicos, dados persistidos, configuração externa ou documentos históricos. Renomear qualquer um deles quebra integrações, links já distribuídos ou dados de clientes.

Meta do rebranding: nenhuma marca antiga visível na experiência padrão. Não se buscou zerar as ocorrências no repositório inteiro.

## Contratos técnicos e integrações

| Identificador | Onde | Por que fica |
|---|---|---|
| `id: 'syshair-premium'` | `src/services/mercadoPago.ts` | ID do plano usado em checkout/preapproval Mercado Pago e em referências de cobrança. O nome visível mudou para "Agenda Fácil 365 Premium". A constante interna `SYSHAIR_PLAN` foi renomeada para `DEFAULT_PLAN`; todos os usos ficam no mesmo arquivo. |
| `plan_name = 'SysHair Premium'` (valor gravado) | `src/hooks/useSubscription.tsx` (`LEGACY_PLAN_NAME`), `supabase/migrations/20241223_subscriptions.sql` (DEFAULT da coluna) | Valor persistido em `subscriptions.plan_name`. A interface exibe via `displayPlanName()` (`src/config/brand.ts`). Nenhum UPDATE foi feito. |
| `plan_name = 'SysHair Trial Extension'` | `src/pages/SuperAdmin.tsx` | Valor gravado pelo superadmin. Exibido via `displayPlanName()`. |
| `x-syshair-webhook-secret` | `supabase/functions/evolution-webhook`, `whatsapp-instances` | Cabeçalho configurado nas instâncias da Evolution API já criadas. |
| `syshair_<tenant>` (nome de instância WhatsApp) | `supabase/functions/whatsapp-instances/index.ts` | Nome das instâncias existentes. Trocar o padrão criaria instâncias duplicadas. |
| `type: "syshair_checkin"` | `src/components/admin/QRCheckIn.tsx` | Payload dos QR codes já impressos e distribuídos. |
| prefixo `syshair 123456` no código de verificação | `supabase/functions/_shared/whatsapp/chatbot.ts` (`parseVerificationCode`) | Continua aceito. O prefixo novo `agenda fácil 365 123456` também passou a ser aceito. Coberto por teste. |
| `belezatech-infinite` (Firebase project, authDomain, storageBucket, client_email) | `src/lib/firebase.ts`, `public/firebase-messaging-sw.js`, `supabase/functions/send-push*` | Projeto Firebase real. Os tokens FCM existentes dependem dele. |
| `admin@syshair.com` | `src/pages/SuperAdmin.tsx`, `supabase/functions/super-admin-actions` | Conta administrativa real usada em guard de autorização. |
| tags de notificação `syshair-fcm-*`, `syshair-push-*`, `syshair-notification-*`, `syshair-foreground-*`, `syshair-marketing-*` | workers e functions de push | Não aparecem para o usuário. Servem para agrupar e substituir notificações. |
| `HTTP-Referer: https://syshair.vercel.app` | `src/utils/aiProviders.ts` | Atribuição de app registrada no OpenRouter (configuração externa). O `X-Title` visível já foi trocado. Revisar junto com o domínio novo. |

## Persistência local (navegador)

| Chave | Onde | Tratamento |
|---|---|---|
| `syshair-mode` | `src/lib/themePreferences.ts`, `index.html` | Lida como fallback e copiada uma única vez para `agenda-facil-365-mode`. A chave antiga não é apagada. |
| `syshair-theme` | `src/lib/themePreferences.ts` | Copiada para `agenda-facil-365-palette`. O antigo padrão `gold` vira `blue`; as outras escolhas são mantidas. |
| `syshair.training.activeTour:${identity}` | `src/features/training/TrainingProvider.tsx` | Mantida sem alteração, para não perder tour em andamento. |
| cache `syshair-v1` | criado pelo antigo `public/sw.js` | Esse worker nunca foi servido em produção, porque o build gera `dist/sw.js` (Workbox) no mesmo caminho. O cache não é apagado de forma indiscriminada. |

## Dados de tenant (não alterados)

`salons.primary_color` / `theme_color` com dourado (`#D4AF37`, `#c9a227`) é escolha do cliente. O azul `#2563EB` só entra como fallback quando o valor está ausente ou inválido (`safeHexColor`). Nenhum UPDATE global foi executado. Mensagens, templates salvos, histórico e notificações já enviadas também não foram alterados.

## Documentos históricos

Os arquivos `*.md`, `*.sql` e `*.txt` da raiz e de `supabase/migrations/` são registros históricos e continuam como estavam. Não reexecute scripts SQL avulsos. A cópia interna `syshair-main/syshair-main/` não foi editada (ver `docs/REBRANDING.md`).

## Nomes de schema

`salons`, `salon_id`, `owner_id`, roles, enums, policies, buckets e RPCs ficam como estão. A interface usa rótulos como "estabelecimento" ou "negócio".
