import type { TourDef } from "../../types";

const CHATBOT = "/admin/whatsapp?aba=chatbot";

export const whatsappAutomationsTour: TourDef = {
  id: "whatsapp-automations",
  version: 1,
  title: "Automações do atendente WhatsApp",
  description: "Lembretes, avaliação, aniversário com cupom, botões e agendamento pelo atendente.",
  category: "whatsapp",
  route: CHATBOT,
  steps: [
    {
      target: "automation-card",
      title: "Automações do atendente",
      body: "Aqui você escolhe o que o WhatsApp do salão envia sozinho. Nada muda até clicar em Salvar automações.",
      fallbackBody: "O card de automações aparece na aba Chatbot quando o salão está cadastrado.",
    },
    {
      target: "automation-reminders",
      title: "Lembretes",
      body: "Ligue o lembrete e escolha até 5 horários (por exemplo, 1 dia e 2 horas antes). A mensagem traz serviço, profissional e endereço. Horário cancelado ou remarcado não recebe o lembrete antigo.",
    },
    {
      target: "automation-review",
      title: "Pedido de avaliação",
      body: "Depois do atendimento concluído, o cliente recebe um pedido de avaliação.",
    },
    {
      target: "automation-birthday",
      title: "Aniversário e cupom",
      body: "A mensagem sai às 9h no horário do salão, uma vez por ano. Clientes que pediram para sair não recebem. O cupom é opcional: individual, de uso único, com o desconto de aniversário do salão e a validade escolhida.",
    },
    {
      target: "automation-interactive",
      title: "Botões e listas",
      body: "Permite ao atendente oferecer opções clicáveis, como serviços e horários, em vez de só texto.",
    },
    {
      target: "automation-booking",
      title: "Agendamento pelo atendente",
      body: "O cliente confirma pelo WhatsApp e o pedido fica pendente até o salão confirmar na agenda.",
    },
    {
      target: "automation-save",
      title: "Salvar",
      body: "Revise as escolhas e clique em Salvar automações quando decidir. O tour não salva por você.",
    },
    {
      target: "payment-proofs-card",
      title: "Comprovantes de pagamento",
      body: "Comprovantes PIX que os clientes enviam pelo WhatsApp aparecem aqui para a equipe conferir.",
      fallbackBody: "Os comprovantes PIX recebidos pelo WhatsApp ficam no card Comprovantes de pagamento.",
    },
    {
      target: "payment-proofs-list",
      title: "Lista de comprovantes",
      body: "Os mais recentes ficam no topo, com status: aguardando conferência, conferido ou recusado.",
      fallbackBody: "A lista aparece quando o card de comprovantes estiver na tela.",
    },
    {
      target: "payment-proofs-actions",
      title: "Conferir comprovante",
      body: "Use Ver para abrir o arquivo e confira se o valor caiu na conta do salão antes de marcar Conferido ou Recusado. Conferir não marca o agendamento como pago.",
      fallbackBody: "As ações aparecem quando há um comprovante aguardando conferência.",
    },
  ],
};
