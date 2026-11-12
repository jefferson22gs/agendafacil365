import type { TourDef } from "../../types";

export const trainingCenterTour: TourDef = {
  id: "training-center", version: 2,
  title: "Central de Treinamento",
  description: "Encontre tutoriais, tours guiados e o andamento dos primeiros passos.",
  category: "start", route: "/admin/training",
  steps: [
    { title: "Aprender no seu ritmo", body: "A Central reúne videoaulas, tutoriais em texto e tours que destacam onde fica cada recurso. Os tours apenas mostram a tela; eles não preenchem, salvam ou enviam nada." },
    { target: "training-overview-button", title: "Passeio pelo painel", body: "Conheça o Agenda Fácil 365 explica o menu, a barra de atalhos do celular, a busca do menu, o grupo WhatsApp e o botão Ajuda." },
    { target: "training-first-steps", title: "Primeiros passos", body: "Quando houver um estabelecimento, esta lista mostra o que já foi configurado e o que falta. A conclusão é verificada pelos dados do estabelecimento, não apenas por abrir a tela.", fallbackBody: "A lista de primeiros passos aparece quando há um estabelecimento vinculado à conta." },
    { target: "training-search", title: "Buscar um assunto", body: "Digite o que quer fazer, como cadastrar serviço, zap ou comissão. A busca considera títulos, resumos e sinônimos dos tutoriais." },
    { target: "training-categories", title: "Filtrar por assunto", body: "Escolha uma categoria para ver só os tutoriais dela. Todos remove o filtro. O contador abaixo informa quantos tutoriais aparecem e quantos você já abriu." },
    { target: "training-videos", title: "Videoaulas", body: "São 28 aulas de cerca de 1 minuto, com narração e legenda, uma para cada parte do sistema. Toque na capa para assistir; Ver todas mostra a trilha completa. Dentro do player, Ler passo a passo abre o tutorial escrito e Abrir tela leva você ao recurso.", fallbackBody: "Nenhuma videoaula corresponde à busca ou ao filtro. Limpe a busca ou escolha Todos." },
    { target: "training-articles", title: "Tutoriais", body: "Ler tutorial abre o passo a passo completo. Me mostre inicia o tour relacionado, que leva você à tela certa. O ícone de concluído indica artigo visto ou tour finalizado.", fallbackBody: "Nenhum tutorial corresponde à busca ou ao filtro. Limpe a busca ou escolha Todos." },
    { target: "training-support", title: "Suporte e recomeço", body: "Falar com o suporte abre uma conversa com a equipe. Reiniciar treinamento pede confirmação e apaga apenas o progresso dos tours e boas-vindas; dados do estabelecimento não mudam." },
  ],
};

export const trainingArticleTour: TourDef = {
  id: "training-article", version: 1,
  title: "Como usar um tutorial",
  description: "Leia os passos, abra a tela relacionada e avalie o conteúdo.",
  category: "start", route: "/admin/training", matchSubroutes: true,
  steps: [
    { target: "training-article-actions", title: "Do texto para a prática", body: "Me mostre onde fazer inicia o tour da tela relacionada. Abrir tela apenas navega até ela. Alguns tutoriais têm só um desses botões.", fallbackBody: "Este tutorial não tem tour ou tela vinculada; siga os passos escritos." },
    { target: "training-article-steps", title: "Passo a passo", body: "Siga os passos na ordem. Quando a imagem de um passo ainda não estiver pronta, o texto continua descrevendo a tela real." },
    { target: "training-article-feedback", title: "Foi útil?", body: "Responda Sim ou Não para registrar se o tutorial ajudou. A resposta fica no seu progresso de treinamento e não altera nenhuma configuração." },
  ],
};
