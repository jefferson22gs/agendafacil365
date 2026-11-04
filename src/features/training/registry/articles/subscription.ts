import type { Article } from "../../types";

export const subscriptionArticles: Article[] = [
  {
    id: "subscription-understand-and-manage",
    version: 1,
    title: "Como entender e gerenciar sua assinatura",
    summary: "Confira status, dias de teste, vencimento, plano e caminhos de pagamento pelo Mercado Pago.",
    category: "settings",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/subscription",
    tourId: "subscription",
    steps: [
      {
        text: "Abra Minha Assinatura, no grupo Configurações e ajuda do menu, e leia o selo no cartão principal. Ele mostra se a assinatura está em teste, ativa, pendente, cancelada, expirada, bloqueada ou sem assinatura.",
        image: { src: "/training/subscription/status.webp", alt: "Cartão de assinatura com selo de situação", pending: true },
      },
      { text: "Durante o teste grátis, confira os dias restantes e a data final. Perto do fim, a tela oferece o caminho para assinar." },
      { text: "Revise tipo de plano, valor e vencimento ou próxima cobrança. Estes dados ajudam a conferir o período registrado no sistema." },
      {
        text: "Se estiver em teste ou sem assinatura ativa, escolha Mensal ou Anual. Depois, o botão Assinar abre o checkout do Mercado Pago em uma nova aba.",
        image: { src: "/training/subscription/plans.webp", alt: "Escolha entre plano mensal e anual", pending: true },
      },
      { text: "Para uma assinatura ativa, use Gerenciar no Mercado Pago para abrir a página de assinaturas e conferir informações diretamente no serviço de pagamento." },
      { text: "Use Atualizar status depois de uma alteração ou pagamento para pedir uma nova consulta aos dados salvos no sistema." },
      {
        text: "O botão Cancelar assinatura abre uma confirmação. Leia tudo antes de prosseguir.",
        image: { src: "/training/subscription/cancel-dialog.webp", alt: "Confirmação de cancelamento da assinatura", pending: true },
      },
      { text: "Se tiver qualquer dúvida de cobrança, renovação ou acesso, use o botão de suporte e confirme a situação com a equipe e com o Mercado Pago." },
    ],
    notes: [
      "Assinar ou renovar abre um checkout externo do Mercado Pago. O sistema não deve prometer aprovação, prazo ou resultado do pagamento.",
      "O cancelamento ainda não está integrado: ao confirmar, o código atual apenas mostra um alerta dizendo que a função será implementada. Ele não cancela no Mercado Pago nem altera a assinatura.",
      "A tela atual afirma na confirmação que o cancelamento não pode ser desfeito, mas essa ação ainda não é executada. Confirme qualquer cancelamento diretamente no Mercado Pago ou com o suporte.",
      "Se o salão ainda não tem assinatura registrada, a consulta pode iniciar automaticamente um teste de 21 dias. Também pode marcar um período vencido como expirado; abrir ou atualizar não é uma consulta totalmente sem alterações.",
      "O selo e as datas vêm dos registros do sistema. Valores padrão podem aparecer quando faltam dados; confira preço, condições de renovação e situação do pagamento diretamente no Mercado Pago.",
    ],
    keywords: ["assinatura", "plano", "mensal", "anual", "teste", "trial", "vencimento", "pagamento", "Mercado Pago", "renovar", "cancelar", "cobrança", "status", "suporte"],
  },
];
