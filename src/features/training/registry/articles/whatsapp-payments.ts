import type { Article } from "../../types";

export const whatsappPaymentArticles: Article[] = [
  {
    id: "whatsapp-payments-setup",
    version: 1,
    title: "Como cobrar pelo WhatsApp (Pix e cartão)",
    summary: "Ligue a cobrança no robô e conecte Mercado Pago, Asaas, PagBank ou InfinitePay para confirmar pagamentos sozinho.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/settings?aba=cobranca",
    tourId: "whatsapp-payments",
    steps: [
      { text: "Abra Configurações no menu e escolha a aba Cobrança." },
      { text: "Ligue Cobrar pelo WhatsApp. Desligado, o robô não oferece pagamento e o cliente paga no salão." },
      { text: "Escolha como recebe. Pix pela chave do salão usa a Chave PIX de Configurações e você confere o comprovante." },
      { text: "Para confirmar sozinho, escolha Mercado Pago, Asaas, PagBank ou InfinitePay e siga o passo a passo da tela para pegar a chave." },
      { text: "Cole a chave e clique em Conectar e testar. O WhatsApp só começa a cobrar depois que o teste dá certo." },
      { text: "Marque o que oferecer (Pix, cartão, pagar no salão) e clique em Salvar cobrança." },
      { text: "Quando o cliente paga, o horário pendente vira confirmado, você recebe o aviso Pagamento recebido e o cliente recebe a confirmação no WhatsApp." },
    ],
    notes: [
      "O dinheiro cai direto na conta do salão no provedor escolhido; o Agenda Fácil não intermedia o pagamento.",
      "A chave fica guardada só no servidor. Na tela aparecem só os últimos 4 caracteres.",
      "Mercado Pago manda o Pix copia e cola dentro da conversa. Nos outros, o cliente paga numa página segura do provedor.",
    ],
    keywords: ["cobrança", "pagamento", "pix", "cartão", "mercado pago", "asaas", "pagbank", "pagseguro", "infinitepay", "cobrar", "zap", "whatsapp"],
  },
];
