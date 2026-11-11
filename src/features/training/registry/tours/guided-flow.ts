import type { TourDef } from "../../types";

export const guidedFlowTour: TourDef = {
  id: "guided-flow",
  version: 1,
  title: "Fluxo de agendamento por botões (Typebot)",
  description: "Menu principal, agendamento passo a passo, remarcação e cancelamento pelo cliente, com simulador.",
  category: "whatsapp",
  route: "/admin/whatsapp?aba=fluxo",
  steps: [
    {
      target: "guided-flow-card",
      title: "Fluxo guiado",
      body: "Ligado, toda conversa no WhatsApp começa no menu: 1 Agendar, 2 Meus agendamentos, 3 Serviços, 4 Endereço, 5 Atendente. O cliente clica no botão ou digita o número. V volta uma etapa e 0 reabre o menu.",
      fallbackBody: "O card aparece quando o salão está cadastrado.",
    },
    {
      target: "guided-flow-simulator",
      title: "Simulador",
      body: "Teste a árvore inteira aqui, com os serviços reais do salão. Nada é agendado de verdade. Salve o fluxo antes para o simulador usar as opções novas.",
    },
    {
      target: "guided-flow-save",
      title: "Salvar",
      body: "Escolha o modo (híbrido é o recomendado), personalize os textos e clique em Salvar fluxo. O tour não salva por você.",
    },
  ],
};
