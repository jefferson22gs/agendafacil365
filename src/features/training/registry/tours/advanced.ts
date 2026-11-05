import type { TourDef } from "../../types";

export const advancedTour: TourDef = {
  id: "advanced", version: 1, title: "Recursos Avançados",
  description: "Conheça as abas e os limites das ferramentas avançadas.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { target: "advanced-header", title: "Ferramentas avançadas", body: "Aqui ficam análise, fidelidade, fila, indicações, Lookbook e metas. Nem tudo é automático: cada guia explica o que realmente funciona." },
    { target: "advanced-tabs", title: "Escolha uma aba", body: "As abas separam as ferramentas. Use o guia específico de cada uma para conhecer seus campos e cuidados." },
    { target: "advanced-bi-tab", title: "BI & IA", body: "Consulte histórico e sugestões. A previsão usa uma regra simples; as chances de venda cruzada são ilustrativas." },
    { target: "advanced-lookbook-tab", title: "Lookbook demonstrativo", body: "Esta aba mostra fotos e nomes de exemplo. Para registrar trabalhos reais, use Galeria, no grupo Relacionamento do menu." },
    { title: "Cuidados ao abrir abas", body: "Metas recalcula e pode atualizar registros ao abrir. Indicações pode criar um código para o primeiro cliente automaticamente; conheça esses avisos antes de explorar." },
    { title: "Próximo passo", body: "Escolha o guia da ferramenta que precisa. Para começar com dados reais, confira seus serviços, clientes e agendamentos." },
  ],
};

export const advancedBiTour: TourDef = {
  id: "advanced-bi", version: 1, title: "BI & IA: interpretar os dados",
  description: "Separe histórico real de estimativas e sugestões ilustrativas.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Análise do salão", body: "Esta aba reúne faturamento, conclusão por horário e sugestões de contato ou venda. As estimativas não são garantias nem previsões de uma IA treinada." },
    { target: "advanced-bi-tab", title: "Abrir BI & IA", body: "Clique em BI & IA para mostrar a ferramenta.", mode: "waitForClick" },
    { target: "advanced-bi-forecast-tab", title: "Previsões", body: "Clique em Previsões para ver faturamento e horários.", mode: "waitForClick", fallbackBody: "A ferramenta aparece quando o salão é encontrado e os dados terminam de carregar." },
    { target: "advanced-bi-forecast", title: "Realizado e estimado", body: "O histórico soma atendimentos concluídos. Os próximos três meses usam o valor do mês atual com crescimento fixo de 5% ao mês, quando há faturamento.", fallbackBody: "Em Previsões aparecem o histórico e a projeção simples de três meses, sem promessa de resultado." },
    { target: "advanced-bi-hourly", title: "Conclusão por horário", body: "O gráfico compara atendimentos concluídos com os agendamentos dos últimos 30 dias, entre 8h e 19h. Não mede o lucro nem a quantidade de vagas livres.", fallbackBody: "A taxa de conclusão por horário fica abaixo do faturamento na aba Previsões." },
    { target: "advanced-bi-churn-tab", title: "Clientes sem retorno", body: "Clique em Risco de Churn. Esse nome significa risco de o cliente deixar de voltar.", mode: "waitForClick", fallbackBody: "Risco de Churn fica dentro de BI & IA." },
    { target: "advanced-bi-churn", title: "Risco por tempo sem visita", body: "A classificação usa dias desde a última visita concluída. A consulta examina até 100 clientes e mostra até cinco em risco; lista vazia não prova que todos voltam.", fallbackBody: "Nesta aba aparece uma lista de até cinco clientes ou uma mensagem de lista vazia." },
    { target: "advanced-bi-execute", title: "Botão sem ação", body: "Executar Ação ainda não tem função ligada. Ele não manda mensagem nem cria cupom; organize o contato por outra tela.", fallbackBody: "Nos cartões de clientes pode aparecer Executar Ação, mas esse botão ainda não faz nada." },
    { target: "advanced-bi-crosssell-tab", title: "Venda de produtos junto ao serviço", body: "Clique em Cross-Sell para consultar sugestões de produtos.", mode: "waitForClick", fallbackBody: "Cross-Sell fica dentro de BI & IA." },
    { target: "advanced-bi-crosssell", title: "Sugestões, não probabilidades reais", body: "As combinações usam cadastro de serviços e produtos ou sugestões pelo nome do serviço. Não há percentual de chance; o valor mostrado é o preço do produto cadastrado.", fallbackBody: "Cadastre serviços para aparecerem sugestões. Elas não vêm do histórico de compras." },
    { title: "Decida com cuidado", body: "Use o histórico como referência e confira as sugestões antes de oferecer descontos. Para falar com clientes, vá a Marketing ou WhatsApp; nada é enviado aqui pelo tour." },
  ],
};

export const advancedLoyaltyTour: TourDef = {
  id: "advanced-loyalty", version: 1, title: "Fidelidade",
  description: "Consulte pontos e entenda os bônus manuais.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Pontos dos clientes", body: "Fidelidade mostra saldo, nível e resumo do programa. Os bônus são alterações reais, não botões de demonstração." },
    { target: "advanced-loyalty-tab", title: "Abrir Fidelidade", body: "Clique em Fidelidade para abrir o painel.", mode: "waitForClick" },
    { target: "advanced-loyalty-client", title: "Conferir o cliente", body: "Escolha o cliente no seletor. Ao carregar, a tela seleciona o primeiro da lista.", fallbackBody: "O seletor aparece depois de carregar o salão. Se não houver clientes, cadastre um em Clientes." },
    { target: "advanced-loyalty-points", title: "Saldo e nível", body: "Veja pontos acumulados, nível e desconto mostrado. Benefícios escritos no cartão não comprovam que brindes ou descontos serão aplicados automaticamente.", fallbackBody: "O cartão de pontos aparece depois de escolher um cliente cadastrado." },
    { target: "advanced-loyalty-bonus", title: "Bônus manual", body: "Quando desejar conceder um bônus, +100 pts ou +50 pts grava pontos para o cliente selecionado. Confira o nome antes; o tour não concede bônus.", fallbackBody: "Os botões de bônus aparecem no cartão do cliente; cada clique adiciona pontos de verdade." },
    { title: "Próximo passo", body: "Confira a regra do seu programa antes de prometer benefícios. Consulte o saldo novamente depois de conceder um bônus." },
  ],
};

export const advancedWaitlistTour: TourDef = {
  id: "advanced-waitlist", version: 1, title: "Fila de Espera",
  description: "Registre interessados sem confundir status com envio ou reserva.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Organizar quem espera", body: "A fila registra pessoas interessadas em uma vaga. Notificar e Agendar apenas mudam o status aqui; contato e reserva precisam ser feitos separadamente." },
    { target: "advanced-waitlist-tab", title: "Abrir a fila", body: "Clique em Fila de Espera para mostrar os registros.", mode: "waitForClick" },
    { target: "advanced-waitlist-list", title: "Ordem da fila", body: "A lista mostra quem aguarda ou está marcado como notificado. As setas alteram a prioridade; registros marcados como agendados ou cancelados saem desta lista.", fallbackBody: "A fila está vazia ou ainda carregando. Depois de adicionar pessoas, os registros aparecem com prioridade e status." },
    { target: "advanced-waitlist-add", title: "Adicionar interessado", body: "Clique em Adicionar à Fila para abrir o cadastro.", mode: "waitForClick", fallbackBody: "O botão Adicionar à Fila aparece quando o salão e a ferramenta carregam." },
    { target: "advanced-waitlist-dialog", title: "Dados e preferências", body: "Informe nome e telefone; serviço, profissional, data e observações são opcionais. Adicionar à Fila salva o registro quando você decidir; não cria um agendamento.", fallbackBody: "Abra Adicionar à Fila para informar o contato e as preferências do cliente." },
    { title: "Contato e reserva separados", body: "Notificar só marca Notificado, sem enviar mensagem. Agendar só marca Agendado, sem reservar horário; combine com o cliente e registre o atendimento na Agenda." },
  ],
};

export const advancedReferralTour: TourDef = {
  id: "advanced-referral", version: 1, title: "Indicações: código e limites",
  description: "Conheça os códigos e os limites do compartilhamento.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Programa de indicações", body: "Esta aba mostra códigos e registros de indicações. Ao abrir, pode criar um código no banco para o primeiro cliente; só prossiga se quiser abrir a ferramenta." },
    { target: "advanced-referral-tab", title: "Abrir com esse cuidado", body: "Clique em Indicações para abrir. A tela seleciona o primeiro cliente e cria um código se ele ainda não tiver um.", mode: "waitForClick" },
    { target: "advanced-referral-client", title: "Escolher o cliente", body: "Confira o nome no seletor. Trocar de cliente também pode criar o código dele automaticamente.", fallbackBody: "Se houver clientes cadastrados, o seletor permite consultar ou criar automaticamente o código de cada um." },
    { target: "advanced-referral-copy-code", title: "Copiar o código", body: "Este botão copia o código de indicação, não uma senha. O cadastro do código não garante desconto no agendamento.", fallbackBody: "O código aparece depois de carregar os dados do cliente escolhido." },
    { target: "advanced-referral-copy-link", title: "Link de agendamento com código", body: "Copiar Link copia o link público de agendamento do estabelecimento junto com o código. O desconto não é aplicado automaticamente: confira o código no atendimento.", fallbackBody: "A opção Copiar Link copia o link de agendamento do estabelecimento e o código de indicação." },
    { target: "advanced-referral-whatsapp", title: "Revisar antes de compartilhar", body: "WhatsApp abre uma mensagem pronta no aplicativo; não a envia sozinho. O texto promete desconto e inclui o link incompleto: não envie sem validar a oferta e corrigir o endereço.", fallbackBody: "A opção WhatsApp abre um texto com desconto e link; eles precisam ser validados antes de enviar." },
    { title: "Limite do programa", body: "Os cartões mostram indicações e ranking, mas esta tela não comprova a aplicação automática das recompensas. Combine benefícios manualmente até confirmar o fluxo completo." },
  ],
};

export const advancedLookbookTour: TourDef = {
  id: "advanced-lookbook", version: 1, title: "Lookbook demonstrativo",
  description: "Explore exemplos sem confundi-los com trabalhos publicados.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Vitrine de exemplo", body: "O Lookbook é demonstrativo: fotos, nomes, preços e contagens são exemplos. Ele não usa os trabalhos cadastrados em Galeria." },
    { target: "advanced-lookbook-tab", title: "Abrir Lookbook", body: "Clique em Lookbook para ver os exemplos.", mode: "waitForClick" },
    { target: "advanced-lookbook-grid", title: "Conhecer um exemplo", body: "Clique em uma foto para abrir os detalhes do exemplo.", mode: "waitForClick", fallbackBody: "O Lookbook mostra três exemplos de transformação; nenhuma foto pertence aos registros do seu salão." },
    { target: "advanced-lookbook-slider", title: "Comparar antes e depois", body: "Mova o dedo ou o mouse sobre a foto para comparar as duas imagens. Isso só muda a visualização do exemplo.", fallbackBody: "Abra uma foto para ver o comparador antes e depois." },
    { target: "advanced-lookbook-cta", title: "Agendamento sem função", body: "Agendar agora e Ver perfil ainda não têm ação ligada. Comentários, compartilhar e Novo Post também não estão ligados a funções reais.", fallbackBody: "Os detalhes mostram botões de agendar e perfil sem função ligada nesta versão." },
    { title: "Registrar trabalhos reais", body: "Vá a Galeria, no grupo Relacionamento do menu, para adicionar fotos de clientes. Curtidas no Lookbook ficam só na tela e não publicam nada." },
  ],
};

export const advancedGoalsTour: TourDef = {
  id: "advanced-goals", version: 1, title: "Metas",
  description: "Cadastre objetivos e acompanhe o progresso com cuidado.",
  category: "advanced", route: "/admin/advanced",
  steps: [
    { title: "Objetivos do salão", body: "Metas acompanha faturamento, agendamentos, novos clientes e avaliação média. Ao abrir, recalcula as metas ativas e pode gravar progresso ou mudar seu status." },
    { target: "advanced-goals-tab", title: "Abrir Metas", body: "Clique em Metas somente se quiser abrir a ferramenta. A atualização automática ocorre ao carregar, mesmo sem criar uma nova meta.", mode: "waitForClick" },
    { target: "advanced-goals-add", title: "Nova meta", body: "Clique em Nova Meta para abrir o formulário.", mode: "waitForClick", fallbackBody: "Nova Meta aparece após carregar o salão e recalcular as metas." },
    { target: "advanced-goals-dialog", title: "Tipo, nome e valor", body: "Escolha o que deseja medir, dê um nome e informe um alvo positivo. Escolha o período; as datas serão definidas automaticamente para o período atual.", fallbackBody: "O formulário pede tipo, nome, valor alvo e período, de diário a anual." },
    { target: "advanced-goals-save", title: "Criar quando estiver pronto", body: "Criar Meta grava o objetivo. Para apenas conhecer, feche o formulário; o tour não cria metas.", fallbackBody: "Quando terminar o formulário, Criar Meta salva o objetivo." },
    { title: "Acompanhar e excluir", body: "Após fechar o formulário, veja o progresso nas metas ativas e o histórico ao lado. A lixeira exclui a meta diretamente, sem confirmação; não clique só para experimentar." },
    { title: "Próximo passo", body: "Mantenha os agendamentos e valores corretos para o cálculo fazer sentido. Uma meta atingida ou vencida pode sair da lista ativa durante a atualização." },
  ],
};

export const advancedTours: TourDef[] = [advancedTour, advancedBiTour, advancedLoyaltyTour, advancedWaitlistTour, advancedReferralTour, advancedLookbookTour, advancedGoalsTour];
