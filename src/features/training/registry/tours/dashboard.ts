import type { TourDef } from "../../types";

export const dashboardTour: TourDef = {
  id: "dashboard",
  version: 1,
  title: "Conheça o Dashboard",
  description: "Veja o resumo do dia, os números do estabelecimento e os atalhos do painel.",
  category: "start",
  route: "/admin",
  steps: [
    {
      target: "dashboard-header",
      title: "Seu resumo do dia",
      body: "Esta é a tela inicial do painel, com a saudação \"Olá\" e o botão Novo agendamento. Ela reúne os agendamentos de hoje, os números do estabelecimento e atalhos para outras telas.",
    },
    {
      target: "dashboard-no-salon",
      title: "Ainda não criou seu estabelecimento?",
      body: "Use Configurar estabelecimento para preencher os dados do estabelecimento. Depois de salvar, volte aqui para acompanhar o movimento.",
      fallbackBody: "Seu estabelecimento já está configurado. Se precisar atualizar nome, contato ou horários, abra Configurações, no grupo Configurações e ajuda do menu.",
    },
    {
      target: "dashboard-stats",
      title: "Os números principais",
      body: "Os cartões mostram agendamentos de hoje, faturamento do mês, clientes cadastrados e um horário da agenda. O contador de hoje inclui todos os agendamentos do dia, não apenas os que ainda vão acontecer.",
      tip: "Próximo horário mostra o primeiro agendamento do dia, mesmo que já tenha passado. O texto Concluídos no faturamento indica o critério usado, não uma comparação com outro período.",
    },
    {
      target: "dashboard-stats",
      title: "Como o faturamento é contado",
      body: "O valor soma os preços finais dos agendamentos concluídos que foram criados desde o começo do mês. Não é o saldo de caixa nem uma soma pela data do atendimento.",
    },
    {
      target: "dashboard-today",
      title: "Agendamentos de hoje",
      body: "Aqui aparecem até cinco agendamentos, em ordem de horário, com cliente, serviço, profissional e situação. Se não houver atendimentos hoje, a tela avisa.",
    },
    {
      target: "dashboard-today-all",
      title: "Ver a agenda completa",
      body: "Quando quiser consultar ou criar agendamentos, clique em Ver todos. O botão leva para a tela de agendamentos; não cria um atendimento sozinho.",
    },
    {
      target: "dashboard-notifications",
      title: "Avisos do salão",
      body: "Confira os avisos recebidos e os que ainda não foram lidos. Marcar como lido altera o aviso; faça isso apenas quando quiser.",
      fallbackBody: "Depois de configurar o salão, esta área mostra os avisos recebidos. Sem avisos, você verá uma mensagem informando isso.",
    },
    {
      target: "dashboard-insights",
      title: "Assistente Inteligente",
      body: "Leia as sugestões disponíveis para seu salão. Algumas oferecem atalhos para clientes ou cupons; esses atalhos apenas abrem a outra tela.",
      tip: "Nenhum insight no momento significa que não há sugestões exibidas, não uma garantia sobre todo o salão.",
      fallbackBody: "Com um salão configurado, aparece o Assistente Inteligente. As sugestões dependem dos dados disponíveis; a área pode estar vazia.",
    },
    {
      target: "dashboard-client-metrics",
      title: "Previsão de Retorno",
      body: "Veja estimativas de retorno e risco de o cliente deixar de frequentar o salão. Use como apoio para decidir um contato, não como um agendamento confirmado.",
      tip: "Sem histórico, alguns clientes podem aparecer sem previsão.",
      fallbackBody: "Com o salão configurado, esta área mostra as métricas disponíveis dos clientes. Sem dados suficientes, pode não haver nenhuma métrica para mostrar.",
    },
    {
      target: "dashboard-quick-actions",
      title: "Atalhos para o trabalho",
      body: "Ações rápidas abre Agendamentos, Clientes, Dashboard Analítico, Pacotes ou Produtos. Novo agendamento abre a tela da agenda, sem salvar nada automaticamente.",
      fallbackBody: "Os atalhos completos aparecem depois de configurar seu estabelecimento. Antes disso, a área oferece o botão Configurar estabelecimento.",
    },
    {
      title: "Próximo passo",
      body: "Se estiver começando, complete os dados, horários, serviços e profissionais do salão. Se já estiver tudo pronto, confira sua agenda de hoje.",
    },
  ],
};
