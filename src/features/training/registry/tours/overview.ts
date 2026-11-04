import type { TourDef } from "../../types";

/** Tour curto de apresentação. Não tenta explicar todas as telas: só onde fica cada coisa. */
export const overviewTour: TourDef = {
  id: "overview",
  version: 1,
  title: "Conheça o Agenda Fácil 365",
  description: "Um passeio rápido pelas principais áreas do painel.",
  category: "start",
  route: "/admin",
  steps: [
    {
      title: "Bem-vindo ao Agenda Fácil 365",
      body: "Em menos de 2 minutos você vai saber onde fica cada coisa. Você pode sair a qualquer momento em \"Pular\" ou com a tecla Esc.",
    },
    {
      target: "layout-sidebar",
      desktopOnly: true,
      title: "Menu principal",
      body: "Todas as áreas do sistema ficam neste menu, organizado em grupos: Operação, Gestão, Relacionamento e Configurações e ajuda. A tela aberta fica destacada.",
    },
    {
      target: "layout-bottom-nav",
      mobileOnly: true,
      title: "Barra de atalhos",
      body: "No celular, os atalhos mais usados ficam aqui embaixo: Início, Agenda, Clientes e Analytics. O restante fica em \"Menu\".",
    },
    {
      target: "sidebar-appointments",
      desktopOnly: true,
      title: "Agendamentos",
      body: "No grupo Operação, Agendamentos mostra a agenda do dia, marca horários e acompanha o status de cada atendimento.",
    },
    {
      target: "sidebar-clients",
      desktopOnly: true,
      title: "Clientes",
      body: "Cadastro e histórico dos seus clientes. Para importar os contatos do celular, use Importar Contatos, no grupo Relacionamento.",
    },
    {
      target: "sidebar-services",
      desktopOnly: true,
      title: "Serviços e equipe",
      body: "Em Serviços você define preços e duração. Logo acima, em Profissionais, cadastra quem atende.",
    },
    {
      target: "sidebar-whatsapp",
      desktopOnly: true,
      title: "WhatsApp",
      body: "No grupo Relacionamento, conecte o WhatsApp do estabelecimento para usar mensagens automáticas, disparos e o assistente com IA.",
    },
    {
      target: "sidebar-financial",
      desktopOnly: true,
      title: "Financeiro",
      body: "No grupo Gestão: faturamento e comissões calculados a partir dos atendimentos concluídos.",
    },
    {
      target: "layout-bottom-menu",
      mobileOnly: true,
      title: "Menu completo",
      body: "Toque em \"Menu\" para ver todas as áreas: Serviços, Profissionais, WhatsApp, Financeiro, Configurações e mais.",
    },
    {
      target: "layout-help-button",
      title: "Ajuda sempre à mão",
      body: "Toque em \"Ajuda\" em qualquer tela para fazer o tour daquela tela, buscar um assunto ou continuar seus primeiros passos.",
    },
    {
      title: "Tudo pronto para começar",
      body: "Siga a lista \"Primeiros passos\" no Início. Ela mostra o que falta para o seu estabelecimento receber agendamentos. Minha Assinatura e a Central de Treinamento ficam em Configurações e ajuda.",
    },
  ],
};
