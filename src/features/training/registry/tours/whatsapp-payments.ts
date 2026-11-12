import type { TourDef } from "../../types";

export const whatsappPaymentsTour: TourDef = {
  id: "whatsapp-payments",
  version: 1,
  title: "Cobrar pelo WhatsApp",
  description: "Ligar a cobrança no robô, escolher Pix ou um provedor (Mercado Pago, Asaas, PagBank, InfinitePay) e conectar a conta.",
  category: "whatsapp",
  route: "/admin/settings?aba=cobranca",
  steps: [
    { target: "payment-enabled", title: "Ligar ou desligar", body: "Ligado, o cliente recebe as formas de pagamento logo depois de agendar no WhatsApp. Desligado, o robô não fala de pagamento e ele paga no salão." },
    { target: "payment-provider", title: "Como você recebe", body: "Pix pela chave do salão é o mais simples (você confere o comprovante). Mercado Pago, Asaas, PagBank e InfinitePay confirmam o pagamento sozinhos e já confirmam o horário." },
    { target: "payment-tutorial", title: "Passo a passo", body: "Cada provedor tem o caminho para pegar a chave. Cole a chave e clique em Conectar e testar: só começa a cobrar depois que o teste dá certo." },
    { target: "payment-save", title: "Salvar", body: "Escolha Pix, cartão e se o cliente pode pagar no salão, e clique em Salvar cobrança. O tour não salva por você." },
  ],
};
