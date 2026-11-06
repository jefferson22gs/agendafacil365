# Demonstração pública — Agenda Fácil 365

## Rodar

```sh
npm ci
npm run demo:dev
# http://127.0.0.1:8082
npm run build:demo
npx vite preview --config vite.config.demo.ts --outDir dist-demo --port 4300
```

O build estático fica em `dist-demo/`. Não depende de nenhuma variável de ambiente, Supabase, Firebase ou banco. O build normal (`npm run build`, `dist/`) permanece separado. `npm run training:demo` continua disponível na porta 8081 com o mesmo banco fictício.

## Publicar em um SEGUNDO projeto Vercel

1. Importe novamente o mesmo repositório como um projeto separado. Use outro domínio/subdomínio; não substitua o projeto de produção nem reutilize sua origem (cookies, storage e workers pertencem à origem).
2. Em Settings → Build and Deployment, configure Framework Preset **Vite**, Build Command **`npm run build:demo`**, Output Directory **`dist-demo`** e Install Command **`npm ci`** (ou o padrão do lockfile). Mantenha a raiz atual do app.
3. Não copie variáveis do projeto real. Não configure `VITE_SUPABASE_URL`, chaves Supabase, Firebase ou pagamentos: a demo não precisa delas. O `envDir` do config aponta para a pasta isolada dos mocks.
4. O `vercel.json` EXISTENTE já tem o rewrite SPA abaixo. Ele é compartilhado pelos dois projetos e não precisa mudar. Não crie `vercel.demo.json`: esse nome não é selecionado automaticamente pela Vercel.

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/" }
  ],
  "trailingSlash": false,
  "cleanUrls": true
}
```

O JSON acima mostra apenas as regras relevantes: preserve os headers já existentes em `vercel.json`.

**Publicação somente estática:** a configuração de build acima não impede que uma importação direta do repositório detecte `api/` como Vercel Functions. Para a demo, publique separadamente apenas o conteúdo gerado em `dist-demo/`, em uma pasta limpa, com um `vercel.json` contendo o rewrite SPA acima. Não envie a raiz do repositório, `api/manifest/[slug].ts`, `supabase/functions/`, arquivos `.env` ou credenciais. Nesse projeto de artefatos estáticos não há etapa de build remoto nem Functions: o build já foi executado com `npm ci` e `npm run build:demo` na origem. Não conecte integrações ou segredos de produção. Confirme no deployment que nenhuma Function foi empacotada; a ausência de variáveis de ambiente não substitui essa separação.

Após publicar, confira `/`, `/admin` e `/s/studio-bella-demo` por navegação direta. Os assets precisam ser servidos antes do fallback SPA, como na Vercel. O HTML inclui `noindex, nofollow` e CSP; o build escreve `robots.txt` com `Disallow: /`.

## O que navegar

- `/`: landing real, com CTA **Entrar na demonstração** e acesso à página pública.
- `/admin`: já autenticado como **Administrador Demo**, com agenda, clientes, financeiro, analytics, profissionais, serviços, produtos, cupons, pacotes e avaliações.
- `/admin/advanced`: BI, fidelidade, metas, indicações e lista de espera.
- `/admin/whatsapp`: desconectado; integrações indisponíveis.
- `/admin/training`: central de treinamento, tours e progresso local.
- `/s/studio-bella-demo`: seleção de serviços/profissional/horários, cadastro fictício e confirmação de agendamento simulado.
- `/professional`: agenda da profissional Ana Souza; `/profile`: perfil e histórico fictício da cliente Mariana Alves.
- `/login` e `/register`: entram diretamente no painel apenas no modo demo. Em produção, os formulários e o `?next=` continuam funcionando normalmente.

Seed: **Studio Bella Demo**, cor `#2563EB`, seis serviços, quatro profissionais, 25 clientes, cinco produtos, dois cupons, dois pacotes, 16 avaliações, assinatura mensal ativa, fidelidade, três metas, seis indicações, quatro pessoas na espera, avisos e métricas. Agendamentos gerados nos últimos 60 dias e próximos 14 dias, sem sobreposição por profissional; domingos fechados. Datas são relativas ao início da sessão. Nomes inventados, e-mails `@example.com`, telefones fictícios `(11) 90000-XXXX`.

## Estado e reinício

As escritas são em memória e aparecem na próxima consulta. Uma cópia em `sessionStorage` por aba sobrevive a F5; se storage estiver bloqueado/cheio, segue em memória. Não existe persistência em servidor nem compartilhamento entre visitantes. **Não insira dados reais.**

**Reiniciar demonstração**, na faixa superior presente em todas as páginas, remove a chave `af365-demo-db-v1` e recarrega o seed. Fechar a aba também encerra o estado; abrir em outro dia recria as datas. Preferências visuais do app não são apagadas. O botão **Contratar** abre apenas a landing real em `https://agendafacil365.com.br/#pricing`.

## Isolamento e limites

- `vite.isolation.ts` é usado somente nos configs demo/training. Substitui o client Supabase e o módulo Firebase por mocks, bloqueia fetch externo e `/api/`/`functions/v1`, popups externos e service workers. A CSP bloqueia scripts/frames/conexões externos; apenas CSS/fontes Google são permitidos.
- Nenhum SW/manifest é registrado; workers de produção e sitemap são retirados de `dist-demo`. Não é um PWA offline.
- Pagamentos, WhatsApp/Evolution, IA, push e upload não executam integrações. Ações mostram **Indisponível na demonstração**. Notificações automáticas após agendar são descartadas; nada é enviado.
- O mock implementa os filtros/joins usados nas telas, não todo PostgREST: sem RLS, transações, constraints, realtime real ou jobs de backend. Views de pacotes e analytics são calculadas localmente. Exportações manuais do próprio navegador podem gerar arquivo local.
- Galeria sem fotos reais; Lookbook é uma vitrine legada com imagens externas bloqueadas pela CSP. Rotas legadas `/agendar/:slug` e confirmação por token não fazem parte do fluxo validado: use `/s/studio-bella-demo`.
- O financeiro usa os mesmos cards/listas do sistema real; gráficos estão em Analytics e BI. Regras/horários e cálculos da UI permanecem os do aplicativo.

## Checks

```sh
npm run build
npm run build:demo
npm run training:check
npm test
```

`tests/rebrand/demo.test.cjs` cobre seed, relações, preços, conflitos de horários, CRUD, joins, upsert composto, views, ordenação, persistência/reinício, analytics e bloqueio das integrações. O build normal não deve conter `Studio Bella Demo`, `Studio Beleza Demo` ou `DEMO-NOT-A-TOKEN`.
