# IA central da plataforma (Google Gemini)

Só o super admin define chave, modelo, treinamento e limites (Super Admin > aba **IA**). Donos de salão não informam chave nem provedor. A plataforma usa só o Gemini; os adapters OpenAI-compatíveis ficam apenas para salões no modo legado.

## Peças
- `supabase/migrations/20261106003000_ai_central.sql`: config (`ai_platform_config`), chave (`ai_private.platform_keys`, sem acesso do navegador), exceções (`ai_salon_limits`), uma linha por chamada paga (`ai_usage`), respostas do chatbot com/sem IA (`ai_reply_log`), RPCs `ai_reserve`/`ai_settle`, `ai_usage_summary`, `ai_usage_report`, `ai_log_reply`, `ai_platform_key_hints` e `get_my_ai_usage()`.
- `supabase/functions/_shared/ai/core.ts`: funções puras (custo, prompt, adapters, ferramentas Gemini, seleção de modelo). Testes: `tests/rebrand/ai.test.cjs`.
- `supabase/functions/_shared/ai/gateway.ts`: config/chave (falha fechada), modelo automático, reserva, chamada, liquidação.
- `supabase/functions/ai-admin`: painel (JWT + `is_super_admin()`); nunca devolve a chave.
- Usam o gateway: chatbot WhatsApp (`_shared/whatsapp/chatbot.ts`), `generate-text-content`, `generate-image-caption`.

## Controle de gasto
1. `ai_reserve` (sob `pg_advisory_xact_lock` global) verifica IA ligada, orçamento do mês, bloqueio e limites do salão, e grava uma linha `reserved` com tokens e custo **máximos estimados** (entrada aproximada + `maxOutputTokens`). Chamadas simultâneas esperam a trava: não usam o mesmo saldo.
2. Só então o Gemini é chamado. Cada turno de ferramenta do chatbot, o teste e a simulação também reservam.
3. `ai_settle` liquida uma única vez:
   - sucesso com uso informado: valor real;
   - sucesso sem uso informado: mantém o maior valor;
   - recusa 4xx (chave inválida, modelo inexistente, 429): devolve a reserva;
   - timeout, falha de rede ou 5xx: mantém a reserva (o Google pode ter cobrado).
4. Erro de banco em qualquer passo bloqueia a chamada (`persistence_failed`). Reserva nunca liquidada continua contando.
- Teste e simulação funcionam com a IA desligada, mas contam no orçamento (exceção limitada a `teste`/`simulacao`).
- **Limites são estimativas.** O teto não é exato: a reserva usa preço de tabela e tokens estimados, e o Google conta tokens à sua maneira. O orçamento é um freio, não uma garantia contratual. Confira o faturamento real no Google.
- ponytail: a soma do mês roda sob trava global. Se o volume crescer muito, trocar por uma tabela de contadores mensais.
- Teste manual do SQL (com ROLLBACK, inclui roteiro de concorrência com duas sessões): `tests/rebrand/ai-reserve.sql`.

## Modelo
- **Automático** (padrão, família Flash, ou "o mais avançado"): `models.list` com a chave; só modelos com `generateContent`, sem preview, experimental, latest, tts, image, embedding, live ou áudio; ordenados por versão. Cache de 24h em `resolved_model`/`resolved_at`. Se a listagem falhar, usa o último resolvido e depois `gemini-3.6-flash` (stable na documentação de 06/11/2026; `gemini-2.5-flash` está descontinuado e será redirecionado em 01/12/2026).
- Gemini 3+: `thinkingConfig.thinkingLevel` (padrão LOW); `temperature` não é enviada (a documentação diz que é ignorada e no futuro dará erro 400). Gemini 2.x: `temperature`, sem `thinkingLevel`.
- Ferramentas: `tools.functionDeclarations` (`parametersJsonSchema`), `toolConfig.functionCallingConfig.mode = AUTO`. A resposta `functionCall` vira `tool_calls` no formato OpenAI. O turno do modelo é reenviado com as partes originais, preservando `thoughtSignature`. As respostas das ferramentas vão num único turno `user` com `functionResponse` (mesmo `name`/`id` e mesma ordem).

## Custo
- Tabela oficial (pricing de 06/11/2026), em US$ por 1M tokens, nível pago padrão:

| Modelo | Entrada | Saída (com raciocínio) | Cache |
|---|---|---|---|
| gemini-3.8-flash / 3.6-flash | 0,75 até 31/12/2026; 1,50 depois | 3,75; 7,50 depois | 0,075; 0,15 depois |
| gemini-3.5-flash-lite | 0,30 | 2,50 | 0,03 |
| gemini-3.1-flash-lite | 0,25 | 1,50 | 0,025 |
| gemini-4-argon | 2 até 30/11/2026; 4 depois | 10; 20 depois | 0,10; 0,20 depois |

  Preço editável no painel (entrada, saída e cache). Modelo fora da tabela usa o maior preço conhecido.
- `thoughtsTokenCount` conta como saída; `cachedContentTokenCount` é cobrado pelo preço de cache; `toolUsePromptTokenCount` conta como entrada.

## Consumo
- `ai_usage_report(from, to, group, salon)`: totais, série por dia, semana (segunda-feira) ou mês no fuso America/Sao_Paulo, por recurso, por modelo, ranking de salões (custo, % do total, erros, bloqueios, custo médio por conversa) e mensagens com/sem IA.
- Respostas do chatbot sem IA (confirmações, fora do horário, encaminhamentos) ficam em `ai_reply_log` (sem custo; não entram em `ai_usage`). O registro é feito pelo `whatsapp-inbound-worker`. Lembretes, aniversários, PIX e campanhas são contados direto do `whatsapp_outbox` (só os enviados).

## Ordem de resolução
1. Config central salva: Gemini com a chave de `ai_private.platform_keys` ou, se ausente, o segredo `GEMINI_API_KEY`. Limites valem.
2. Sem config central (até o primeiro "Ativar"): chatbot usa a chave antiga do salão; texto e legenda usam `ai_provider_keys` ou `GEMINI_API_KEY`. Sem limites, mas o uso é registrado. Única exceção sem reserva: legado com a migração ainda não aplicada.

## Demo
`mockSupabase.ts` responde `generate-text-content`, `generate-image-caption` e `get_my_ai_usage` com dados fictícios, sem rede.
