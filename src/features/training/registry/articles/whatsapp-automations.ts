import type { Article } from "../../types";

export const whatsappAutomationArticles: Article[] = [
  {
    id: "whatsapp-automations-setup",
    version: 1,
    title: "Como configurar as automações do atendente WhatsApp",
    summary: "Lembretes, avaliação, aniversário com cupom, botões, agendamento e comprovantes PIX.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/whatsapp?aba=chatbot",
    tourId: "whatsapp-automations",
    steps: [
      { text: "Abra WhatsApp no menu e escolha a aba Chatbot. Role até o card Automações do atendente." },
      { text: "Ligue Lembrete antes do horário e escolha até 5 horários. A mensagem traz serviço, profissional e endereço do salão." },
      { text: "Ligue Pedir avaliação para o cliente receber o pedido depois do atendimento concluído." },
      { text: "Ligue Mensagem de aniversário: sai às 9h no horário do salão, uma vez por ano, e respeita quem pediu para sair." },
      { text: "Opcional: Incluir cupom de presente cria um cupom individual de uso único com o desconto de aniversário do salão. Defina a validade em dias." },
      { text: "Botões e listas deixam o atendente oferecer opções clicáveis. Atendente pode criar agendamentos gera pedidos pendentes para o salão confirmar." },
      { text: "Clique em Salvar automações." },
      { text: "No card Comprovantes de pagamento, abra cada comprovante PIX com Ver e marque Conferido ou Recusado depois de checar a conta do salão." },
    ],
    notes: [
      "Tudo depende do WhatsApp conectado na aba Conexão.",
      "Conferir um comprovante não marca o agendamento como pago.",
      "O percentual do cupom vem das configurações do salão (desconto de aniversário).",
    ],
    keywords: ["automação", "lembrete", "aniversário", "cupom", "avaliação", "botões", "chatbot", "agendamento", "pix", "comprovante", "zap", "whatsapp"],
  },
];
