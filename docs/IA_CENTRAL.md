# IA central da plataforma

Só o super admin define provedor, modelo, chave, treinamento e limites (Super Admin > aba **IA**). Donos de salão não informam chave nem provedor.

## Peças
- `supabase/migrations/20261106003000_ai_central.sql`: `ai_platform_config` (linha única), `ai_private.platform_keys` (chave; sem acesso de anon/authenticated), `ai_salon_limits` (exceções), `ai_usage` (uma linha por chamada), RPCs `ai_quota_state`, `ai_usage_summary`, `ai_platform_key_hints` (só os 4 últimos caracteres) e `get_my_ai_usage()` (dono: agregado do mês dos próprios salões).
- `supabase/functions/_shared/ai/core.ts`: funções puras (custo, cota, erros, prompt, adapters). Testes em `tests/rebrand/ai.test.cjs`.
- `supabase/functions/_shared/ai/gateway.ts`: resolve config/chave, checa cota, chama o provedor (timeout 20 s), registra uso.
- `supabase/functions/ai-admin`: painel (JWT + `is_super_admin()`); nunca devolve a chave.
- Usam o gateway: chatbot WhatsApp (`_shared/whatsapp/chatbot.ts`), `generate-text-content`, `generate-image-caption`.

## Ordem de resolução
1. Config central salva: provedor/modelo dela; chave de `ai_private.platform_keys` ou, se ausente, o segredo `<PROVEDOR>_API_KEY` (ex.: `GEMINI_API_KEY`). Cotas valem.
2. Sem config central (modo legado, até o primeiro "Ativar"): chatbot usa a chave antiga do salão; texto/legenda usam `ai_provider_keys` e depois `GEMINI_API_KEY`/`GROQ_API_KEY`/`OPENAI_API_KEY`. Sem limites, mas o uso já é registrado.

## Limites
Orçamento mensal global (US$, custo estimado) e limite por salão (requisições e/ou tokens; exceção do salão vence o padrão). Ao atingir: chatbot envia a resposta padrão (ou também passa a conversa para a equipe); texto/legenda retornam erro amigável. Mês = fuso America/Sao_Paulo.

## Demo
`mockSupabase.ts` responde `generate-text-content`, `generate-image-caption` e `get_my_ai_usage` com dados fictícios, sem rede.
