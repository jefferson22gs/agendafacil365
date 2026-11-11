import type { Article } from "../../types";

export const contractArticles: Article[] = [
  {
    id: "contract-sign", version: 1, title: "Como assinar o contrato do Agenda Fácil 365",
    summary: "Confirme os dados do estabelecimento e assine eletronicamente via Autentique.",
    category: "settings", difficulty: "fácil", minutes: 3, route: "/admin/contract", tourId: "contract",
    steps: [
      { text: "Abra Contrato no menu. Escolha o plano e confira os dados do estabelecimento e do responsável legal." },
      { text: "Clique em Revisar contrato preenchido e leia o texto. Ele já traz seus dados, o plano, o valor por extenso e as datas do teste grátis." },
      { text: "Marque a declaração de poderes e clique em Gerar e Assinar Contrato Digitalmente. O link da Autentique abre e também chega no seu e-mail." },
      { text: "A tela mostra quem já assinou. Quando as duas partes assinarem, o botão Baixar contrato assinado aparece." },
    ],
    notes: ["O contrato é assinado pelo responsável legal informado; quem assina declara ter poderes para representar o estabelecimento."],
    keywords: ["contrato", "assinatura", "autentique", "assinar", "termos", "cnpj"],
  },
];
