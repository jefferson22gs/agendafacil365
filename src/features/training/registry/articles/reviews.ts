import type { Article } from "../../types";

export const reviewsArticles: Article[] = [
  {
    id: "reviews-read-reply", version: 1, title: "Como ler e responder às avaliações dos clientes",
    summary: "Confira estrelas e comentários e grave uma resposta quando estiver pronta.",
    category: "marketing", difficulty: "fácil", minutes: 3, route: "/admin/reviews", tourId: "reviews",
    steps: [
      { text: "Abra Avaliações. Os retornos vêm do formulário de avaliação do atendimento e do convite para avaliar uma visita anterior na página do salão; não há importação do Google nesta tela." },
      { text: "Confira média geral, total e respondidas. Cada cartão mostra cliente, profissional, estrelas de 1 a 5, data e comentário quando preenchido.", image: { src: "/training/reviews/list.webp", alt: "Resumo e cartões das avaliações", pending: true } },
      { text: "Em uma avaliação sem resposta, clique em Responder. Escreva com respeito e revise antes de Enviar; Cancelar fecha sem gravar o texto.", image: { src: "/training/reviews/reply.webp", alt: "Campo de resposta de uma avaliação", pending: true } },
      { text: "Enviar grava a resposta e a data. O cartão passa a mostrar Sua resposta; não há opção de editar ou excluir essa resposta aqui." },
    ],
    notes: ["Esta tela não oferece controle de visibilidade, apesar de existir o campo is_public nos registros.", "Avaliações públicas e respostas aparecem ao tocar nas estrelas do profissional durante o agendamento. O nome do cliente é abreviado. Responder não envia WhatsApp ao cliente.", "No portal Meus agendamentos, o histórico oferece Avaliar para atendimentos concluídos sem nota nos últimos 30 dias. Após avaliar, mostra as estrelas. No WhatsApp, Meus agendamentos também oferece a avaliação.", "Para enviar o convite automático assim que o atendimento é concluído, ative Pedir avaliação nas automações do WhatsApp. A API oficial só envia mensagens livres dentro da janela de atendimento permitida pela Meta."],
    keywords: ["avaliação", "nota", "estrelas", "comentário", "responder", "reclamação", "público", "Google"],
  },
];
