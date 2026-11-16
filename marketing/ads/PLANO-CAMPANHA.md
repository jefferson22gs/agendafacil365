# Campanha Meta: Agenda Fácil 365

Objetivo: cadastros no teste grátis de 30 dias (sem cartão). Planos: R$ 39,90/mês ou R$ 400/ano (R$ 33,33/mês).

## Medição (pronta no código)

| Evento | Onde dispara | Navegador (Pixel) | Servidor (Conversions API) |
|---|---|---|---|
| PageView | Landing (`/`) e cadastro (`/register`) | sim | não |
| CompleteRegistration | Cadastro concluído | sim | sim, com e-mail e telefone em hash SHA-256 |
| Contact | Clique em "Falar no WhatsApp" da landing | sim | sim |

- O Pixel só carrega depois de "Aceitar" no aviso de cookies (LGPD). Quem recusa não é rastreado.
- O navegador e o servidor mandam o mesmo `event_id`, e a Meta deduplica.
- Painel, página pública dos salões e área do cliente não têm Pixel: os clientes dos salões nunca são rastreados.

### Para ligar

1. No Gerenciador de Eventos, crie um Pixel (conjunto de dados) e copie o ID.
2. Vercel: `VITE_META_PIXEL_ID=<ID>` e redeploy.
3. Supabase (secrets): `META_PIXEL_ID=<ID>` e `META_CAPI_TOKEN=<token gerado em Configurações do conjunto de dados > Conversions API>`.
4. Teste: `META_CAPI_TEST_CODE=<código da aba Testar eventos>`. Remova depois do teste.
5. Verifique o domínio agendafacil365.com.br no Gerenciador de Negócios e priorize `CompleteRegistration`.

## Estrutura

### Campanha 1: Cadastros (conversão)
- Objetivo: Leads, otimizando para conversão no site (`CompleteRegistration`). Enquanto houver menos de 50 cadastros por semana, otimizar para `Contact` ou cliques no link.
- Posicionamentos (manuais):
  - Status do WhatsApp: confirmar no Gerenciador se está disponível para a conta e para o objetivo.
  - Instagram Stories e Reels.
  - Facebook Stories e Feed.
  - Instagram Feed.
- Destino: `https://agendafacil365.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=cadastro&utm_content={{ad.name}}`

### Campanha 2: Conversas no WhatsApp (clique para mensagem)
- Objetivo: Engajamento > Mensagens no WhatsApp, para o número de vendas.
- Mensagem inicial: "Olá! Quero conhecer o Agenda Fácil 365."
- Serve para quem prefere tirar dúvidas antes de se cadastrar.

### Públicos
- Brasil, 22–60 anos.
- Interesses: salão de beleza, barbearia, estética, manicure, design de sobrancelha, cabeleireiro, empreendedorismo, pequenas empresas.
- Comportamento: administradores de páginas de negócios.
- Depois de 50 cadastros: público semelhante (lookalike) de 1% dos cadastrados.
- Remarketing: quem visitou a landing nos últimos 30 dias e não se cadastrou.

### Verba sugerida para o teste (7 dias)
- Campanha 1: R$ 30/dia
- Campanha 2: R$ 20/dia
- Total: cerca de R$ 350 na semana.
- Corte: anúncio com custo por cadastro 2x acima da média, ou CTR abaixo de 0,8% após R$ 40 gastos.

## Criativos (`marketing/ads/out/`)

| Arquivo | Formato | Uso | Mensagem |
|---|---|---|---|
| `a-story.png` | 1080x1920 | Status, Stories, Reels | Pare de agendar pelo WhatsApp na mão |
| `b-story.png` | 1080x1920 | Status, Stories, Reels | Menos faltas, mais clientes voltando + preço |
| `c-square.png` | 1080x1080 | Feed | Sua agenda cheia, clientes voltando sozinhos |
| `d-square.png` | 1080x1080 | Feed | O robô que agenda por você no WhatsApp |

Para editar: altere `creatives.html` e rode `python marketing/ads/render.py`.

### Textos

**Texto principal A:** Cansado de responder "tem horário?" o dia inteiro? O Agenda Fácil 365 agenda, confirma e lembra seus clientes pelo WhatsApp, sozinho. Teste 30 dias grátis, sem cartão.
**Texto principal B:** Cliente que esquece é horário perdido. Com lembrete automático e aviso de retorno, sua agenda fica cheia e seus clientes voltam. A partir de R$ 33,33/mês.
**Títulos:** Teste grátis por 30 dias · Agenda online + WhatsApp · Feito para salões e barbearias
**Botão:** Cadastre-se (Campanha 1) · Enviar mensagem (Campanha 2)

## Antes de ativar (checklist)
- [ ] Pixel e Conversions API ligados e eventos aparecendo em "Testar eventos"
- [ ] Domínio verificado
- [ ] Forma de pagamento na conta de anúncios
- [ ] Campanhas criadas **pausadas** e revisadas pelo dono
- [ ] Política de privacidade publicada no site citando cookies da Meta (pendente: o site ainda não tem essa página)
