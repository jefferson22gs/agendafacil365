import type { Article } from "../../types";

export const dashboardArticles: Article[] = [
  {
    id: "dashboard-daily-summary",
    version: 1,
    title: "Como acompanhar o dia pelo Dashboard",
    summary: "Confira agendamentos, números do salão, avisos e atalhos na tela inicial.",
    category: "start",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin",
    tourId: "dashboard",
    steps: [
      {
        text: "Abra Dashboard no painel. Se ainda não tiver um estabelecimento cadastrado, use Configurar estabelecimento e salve os dados antes de acompanhar o movimento.",
        image: { src: "/training/dashboard/overview.webp", alt: "Tela inicial com números do salão e resumo do dia", pending: false },
      },
      { text: "Se aparecerem Boas-vindas e Primeiros passos, use esses cartões para conhecer o sistema e completar a configuração que falta. Eles aparecem conforme o estágio do salão e podem ser dispensados." },
      { text: "No topo, o botão Novo agendamento abre a tela da agenda. Leia os cartões de agendamentos de hoje e clientes cadastrados. O primeiro conta todos os agendamentos do dia; o segundo mostra o total de clientes cadastrados, não somente quem visitou recentemente." },
      { text: "Confira Faturamento do mês. Ele soma os preços finais de agendamentos concluídos criados desde o começo do mês; não representa o saldo de caixa nem seleciona pela data do atendimento." },
      {
        text: "Em Agendamentos de hoje, veja até cinco registros, em ordem de horário, com cliente, serviço, profissional e situação. Use Ver todos para abrir a tela da agenda.",
        image: { src: "/training/dashboard/today-appointments.webp", alt: "Lista de agendamentos do dia e botão Ver todos", pending: true },
      },
      { text: "Leia Notificações e as sugestões do Assistente Inteligente. Se houver atalhos para clientes ou cupons, eles abrem essas telas; não enviam uma mensagem nem criam um cupom por conta própria." },
      { text: "Em Previsão de Retorno, use as estimativas como apoio para decidir um contato com o cliente. Uma data prevista não é um atendimento confirmado, e a área pode estar vazia quando não há métricas disponíveis." },
      { text: "Use Ações rápidas para abrir Agendamentos, Clientes, Dashboard Analítico, Pacotes ou Produtos. Novo agendamento apenas abre a tela da agenda, onde você decide o que cadastrar." },
    ],
    notes: [
      "Próximo horário mostra o primeiro agendamento do dia, mesmo que já tenha passado. O texto Concluídos no cartão de faturamento indica o critério usado; não é uma comparação calculada com outro período.",
      "Ao abrir o Dashboard, o sistema solicita a geração de sugestões e o cálculo das métricas dos clientes. Esses cálculos podem gravar dados; não use produção para demonstrações.",
      "Os atalhos completos, sugestões, métricas e notificações dependem de existir um salão configurado.",
    ],
    keywords: ["dashboard", "painel", "início", "resumo", "agenda", "hoje", "faturamento", "clientes", "avisos", "insights", "retorno", "estabelecimento"],
  },
];
