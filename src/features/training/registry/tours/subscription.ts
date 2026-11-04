import type { TourDef } from "../../types";

export const subscriptionTour: TourDef = {
  id: "subscription",
  version: 1,
  title: "Minha Assinatura",
  description: "Veja situação, teste grátis, plano, pagamento e suporte da assinatura.",
  category: "settings",
  route: "/admin/subscription",
  steps: [
    {
      target: "subscription-header",
      title: "Minha Assinatura",
      body: "Esta tela mostra a situação da sua assinatura do Agenda Fácil 365 Premium e os caminhos de pagamento pelo Mercado Pago.",
    },
    {
      target: "subscription-refresh",
      title: "Atualizar status",
      body: "Use este botão para conferir os registros da assinatura; ele não confirma pagamentos no Mercado Pago. A consulta pode iniciar um teste quando falta registro ou marcar um período vencido como expirado.",
    },
    {
      target: "subscription-status",
      title: "Situação atual",
      body: "O selo mostra se a assinatura está em teste, ativa, pendente, cancelada, expirada, bloqueada ou sem assinatura.",
    },
    {
      target: "subscription-trial",
      title: "Período de teste",
      body: "Quando você está no teste grátis, esta área mostra quantos dias restam.",
      fallbackBody: "Se sua assinatura não estiver em teste, esta área não aparece.",
    },
    {
      target: "subscription-details",
      title: "Dados do plano",
      body: "Confira o plano e o valor registrados, sem tratar os valores padrão como comprovante de cobrança. No teste aparece a data final; na assinatura paga, pode aparecer vencimento ou próxima cobrança.",
    },
    {
      target: "subscription-period-end",
      title: "Vencimento ou próxima cobrança",
      body: "Quando existe uma data de fim do período, ela aparece aqui. Use essa data para se organizar antes do vencimento.",
      fallbackBody: "Durante o teste, a tela pode mostrar o fim do período de teste em vez da próxima cobrança.",
    },
    {
      target: "subscription-plans",
      title: "Escolha de plano",
      body: "Quando você está em teste ou sem assinatura ativa, pode escolher Mensal ou Anual antes de abrir o pagamento.",
      fallbackBody: "Se sua assinatura já está ativa, a escolha de plano não aparece nesta tela.",
    },
    {
      target: "subscription-subscribe",
      title: "Assinar ou renovar",
      body: "Este botão abre o checkout do Mercado Pago em uma nova aba. O tour não clica nele para não iniciar pagamento sem você querer.",
      fallbackBody: "Quando for hora de assinar ou renovar, o botão abre o Mercado Pago em uma nova aba.",
    },
    {
      target: "subscription-manage",
      title: "Gerenciar no Mercado Pago",
      body: "Com assinatura ativa, este caminho abre a página do Mercado Pago para você consultar a assinatura por lá.",
      fallbackBody: "Se a assinatura ainda não estiver ativa, aparece o botão de assinar ou renovar no lugar deste link.",
    },
    {
      target: "subscription-cancel",
      title: "Cancelar assinatura",
      body: "Este botão abre uma confirmação, mas confirmar só mostra um alerta: o cancelamento ainda não está integrado. Para cancelar de verdade, confira o Mercado Pago ou fale com o suporte.",
      fallbackBody: "O botão de cancelamento aparece para assinatura ativa fora do período de teste.",
    },
    {
      target: "subscription-support",
      title: "Ajuda",
      body: "Se tiver dúvida sobre pagamento ou acesso, use o botão de suporte para chamar a equipe pelo WhatsApp.",
    },
    {
      title: "Pronto!",
      body: "Revise sempre o status antes de tomar uma decisão. Para pagamentos, confirme as informações diretamente no Mercado Pago.",
    },
  ],
};
