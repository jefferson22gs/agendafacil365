# Serviço "QR Code com botões" (whaileys)

Terceira conexão de WhatsApp do AgendaFácil 365. Envia **botões e listas clicáveis** por QR Code usando a
biblioteca [whaileys](https://github.com/canove/whaileys) (fork do Baileys que inclui o nó `biz` que o WhatsApp
exige para exibir botões).

O serviço **não tem robô próprio**. Ele expõe o mesmo contrato HTTP da Evolution API 2.3.7, então o AgendaFácil usa
o robô, as regras, os pacotes, as cobranças e a IA que já existem. A personalidade usa o **nome de cada salão**
(cadastrado em Configurações), automaticamente.

## O que faz

| Recurso | Como |
|---|---|
| Conexão por QR Code | `GET /instance/connect/:nome` devolve o QR em base64; reconecta sozinho após queda; sessão salva em `/data` |
| Botões (até 3) | `POST /message/sendButtons/:nome` |
| Botões com imagem | `sendButtons` com `image` (URL de origem permitida) |
| Lista (até 10 linhas) | `POST /message/sendList/:nome` |
| Texto, mídia, enquete | `sendText`, `sendMedia`, `sendPoll` |
| Status (texto, foto, vídeo) | `POST /message/sendStatus/:nome` com `statusJidList` explícita, em lotes |
| Status automático por pasta | `data/instances/<nome>/status-inbox/` + `schedule.json` + `captions.json` (ver abaixo) |
| Respostas e cliques do cliente | Webhook para o AgendaFácil (`evolution-webhook`), com fila durável e nova tentativa |
| Histórico por contato | `data/instances/<nome>/history.jsonl` (últimas 5.000 mensagens), usado em `findMessages`/`findContacts` |
| "Digitando…" | `POST /chat/sendPresence/:nome` |
| Comprovante Pix (mídia recebida) | `POST /chat/getBase64FromMediaMessage/:nome` |

## Instalação (servidor com Docker)

```bash
cd services/whaileys
docker build -t agendafacil-whaileys .
docker run -d --name whaileys --restart unless-stopped -p 8080:8080 \
  -v whaileys-data:/data \
  -e WHAILEYS_API_KEY="<chave longa e aleatória, 24+ caracteres>" \
  -e WHAILEYS_WEBHOOK_ORIGINS="https://<projeto>.supabase.co" \
  -e WHAILEYS_MEDIA_ORIGINS="https://<projeto>.supabase.co" \
  agendafacil-whaileys
```

Coloque um proxy HTTPS na frente (ex.: o mesmo Nginx/Traefik da Evolution) e depois cadastre no Supabase:

```bash
supabase secrets set WHAILEYS_API_URL="https://botoes.seudominio.com.br" WHAILEYS_API_KEY="<a mesma chave>"
```

Sem esses dois secrets, o painel não mostra a conexão com botões.

## Variáveis

| Variável | Obrigatória | Padrão | Para quê |
|---|---|---|---|
| `WHAILEYS_API_KEY` | sim | | Chave que o AgendaFácil envia no cabeçalho `apikey` (mín. 24 caracteres) |
| `WHAILEYS_WEBHOOK_ORIGINS` | sim | | Origens https permitidas para o webhook (vírgula). Outra origem é recusada |
| `WHAILEYS_MEDIA_ORIGINS` | para mídia | | Origens https de onde o serviço pode baixar mídia (ex.: Storage do Supabase) |
| `WHAILEYS_DATA_DIR` | não | `./data` | Sessões, filas, histórico e pastas de Status |
| `PORT` / `HOST` | não | `8080` / `0.0.0.0` | |
| `WHAILEYS_MAX_INSTANCES` | não | `200` | Limite de salões por servidor |
| `WHAILEYS_MAX_MEDIA_BYTES` | não | 16 MB | Tamanho máximo de mídia baixada |
| `WHAILEYS_STATUS_BATCH` | não | `10` | Contatos por lote ao publicar Status |
| `LOG_LEVEL` | não | `info` | Logs não incluem chaves nem conteúdo de mensagens |

## Status automático por pasta (no servidor)

Para cada salão, em `data/instances/<nome>/status-inbox/`:

- coloque fotos (`.jpg`, `.png`, `.webp`) ou vídeos (`.mp4`); a ordem é a do nome (`01-…`, `02-…`);
- `captions.json`: `{ "01-promo.jpg": "Promoção da semana" }` (legenda opcional por arquivo);
- `schedule.json`: `{ "enabled": true, "times": ["09:00", "18:00"], "timezoneOffsetMin": -180 }`.

A cada horário o serviço publica o próximo arquivo e move para `posted/` (ou `failed/`). Nunca republica.
Também dá para ler e ajustar a agenda por HTTP: `GET/POST /status-folder/:nome`.

A pasta fica **no servidor**, não no celular do salão. O Agendador de Status do painel continua sendo o jeito
recomendado (o dono escolhe arquivo, legenda e horário pela tela).

## Segurança

- Toda rota (menos `/health`) exige `apikey`; comparação em tempo constante.
- Nome de instância validado (`[A-Za-z0-9_-]`), sem acesso fora da pasta da instância.
- Webhook e download de mídia só para origens https configuradas, sem redirecionamento (bloqueia SSRF).
- Sessões gravadas com permissão `600`; o volume `/data` deve ser privado.
- Só conversas individuais: grupos, canais e LID sem número real são descartados.

## Limitações (honestas)

- **Botões pelo QR Code são um recurso não oficial.** O WhatsApp pode deixar de exibi-los sem aviso. Por isso o
  robô manda os números no texto de cada menu, e o cliente sempre consegue responder digitando.
- Envios em massa por QR Code têm risco de bloqueio do número.
- Não testado em produção contra o WhatsApp real a partir do ambiente de desenvolvimento (a rede local bloqueia o
  WebSocket do WhatsApp). Os contratos e o fluxo ponta a ponta foram testados com um socket simulado.
- Pode usar o mesmo número das outras conexões (o WhatsApp aceita até 4 aparelhos conectados).

## Testes

```bash
npm install --ignore-scripts
npm test
```
