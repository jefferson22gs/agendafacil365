import type { TourDef } from "../../types";

export const reviewsTour: TourDef = {
  id: "reviews", version: 1, title: "Avaliações",
  description: "Leia notas e comentários, depois responda quando desejar.",
  category: "marketing", route: "/admin/reviews",
  steps: [
    { target: "reviews-header", title: "Opiniões dos clientes", body: "Aqui aparecem avaliações recebidas pelo formulário de avaliação ou pela página do salão. Não há importação de avaliações do Google nesta tela." },
    { target: "reviews-summary", title: "Resumo das avaliações", body: "Veja média das notas, total de avaliações e quantas receberam resposta. As estrelas vão de uma a cinco." },
    { target: "reviews-list", title: "Leia antes de responder", body: "Cada cartão mostra cliente, profissional, estrelas e data; o comentário só aparece se foi preenchido. A tela não oferece controle de visibilidade.", fallbackBody: "Quando receber uma avaliação, ela aparecerá com estrelas e data; comentários são opcionais. Ainda não há controle de visibilidade aqui." },
    { target: "reviews-reply-button", title: "Abrir uma resposta", body: "Clique em Responder para mostrar o campo. Avaliações já respondidas exibem a resposta, sem botão de edição nesta tela.", mode: "waitForClick", fallbackBody: "Responder aparece somente em avaliações sem resposta. Se todas já estiverem respondidas ou a lista estiver vazia, não há campo para abrir." },
    { target: "reviews-reply-text", title: "Escreva e revise", body: "Escreva uma resposta curta e respeitosa. Enviar salva a resposta; o tour não envia por você, e não há confirmação de envio por WhatsApp nem de publicação para o cliente.", fallbackBody: "Ao abrir Responder, você verá o campo e os botões Cancelar e Enviar. Enviar grava a resposta, sem mandar mensagem ao cliente." },
    { title: "Reputação do profissional", body: "Na escolha do profissional, o cliente vê média, estrelas e quantidade de avaliações públicas. Ao tocar nas estrelas, abre comentários e respostas do salão, com rolagem. O nome do cliente fica abreviado." },
    { title: "Como pedir uma avaliação", body: "Marque o atendimento como Concluído. Com Pedir avaliação ativado nas automações do WhatsApp, o convite sai na hora. O histórico em Meus agendamentos também oferece Avaliar para atendimentos concluídos, sem nota e com até 30 dias." },
  ],
};
