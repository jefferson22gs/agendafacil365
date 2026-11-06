import type { Article } from "../../types";

const ROUTE = "/admin/whatsapp?aba=contatos&contatos=importar";

export const importContactsArticles: Article[] = [
  {
    id: "import-contacts-vcf-file",
    version: 2,
    title: "Como importar contatos por arquivo VCF ou CSV",
    summary: "Envie um arquivo do celular ou uma planilha e transforme os contatos em clientes.",
    category: "clients",
    difficulty: "fácil",
    minutes: 5,
    route: ROUTE,
    tourId: "import-contacts",
    steps: [
      {
        text: "Abra WhatsApp no menu, escolha a aba Contatos e depois Importar.",
        image: { src: "/training/import-contacts/vcf-card.webp", alt: "Opção Arquivo VCF ou CSV", pending: true },
      },
      { text: "Clique em Escolher arquivo e selecione um .vcf exportado do celular ou um .csv de até 5 MB." },
      { text: "No CSV, escolha as colunas de nome, telefone (obrigatório) e e-mail e clique em Gerar prévia." },
      { text: "Na prévia, só contatos Novos podem ser marcados. Já cadastrados, repetidos e inválidos ficam de fora." },
      { text: "Clique em Importar selecionados e confirme. Repetir a importação não duplica contatos." },
    ],
    notes: ["Importar um contato não significa que ele autorizou receber campanhas."],
    keywords: ["vcf", "csv", "arquivo", "planilha", "contatos do celular", "exportei contatos", "importar agenda"],
  },
  {
    id: "import-contacts-phone-picker",
    version: 2,
    title: "Como importar contatos direto do celular",
    summary: "Em navegadores compatíveis, selecione contatos sem criar arquivo.",
    category: "clients",
    difficulty: "médio",
    minutes: 4,
    route: ROUTE,
    tourId: "import-contacts",
    steps: [
      {
        text: "Na aba Contatos, em Importar, toque em Selecionar contatos no cartão Contatos do celular.",
        image: { src: "/training/import-contacts/phone-card.webp", alt: "Opção Contatos do celular", pending: true },
      },
      { text: "Escolha os contatos na agenda do aparelho." },
      { text: "Confira a prévia e deixe marcados só os novos que devem virar clientes." },
      { text: "Clique em Importar selecionados e confirme." },
    ],
    notes: ["Depende do navegador, geralmente Chrome no Android. Se não aparecer, exporte um VCF pelo celular."],
    keywords: ["celular", "android", "agenda do telefone", "selecionar contatos", "navegador"],
  },
  {
    id: "import-contacts-whatsapp-evolution",
    version: 2,
    title: "Como importar contatos do WhatsApp",
    summary: "Traga os contatos do WhatsApp conectado do salão para a lista de clientes.",
    category: "clients",
    difficulty: "fácil",
    minutes: 4,
    route: ROUTE,
    tourId: "import-contacts",
    steps: [
      { text: "Conecte o WhatsApp do salão na aba Conexão." },
      { text: "Na aba Contatos, em Importar, clique em Buscar contatos no cartão WhatsApp do estabelecimento." },
      { text: "Confira a prévia e desmarque quem não quiser salvar. Grupos e status não entram." },
      { text: "Clique em Importar selecionados e confirme." },
    ],
    notes: ["Se o WhatsApp tiver mais de 10.000 contatos, a lista é limitada."],
    keywords: ["whatsapp", "buscar contatos", "zap", "conexão"],
  },
];
