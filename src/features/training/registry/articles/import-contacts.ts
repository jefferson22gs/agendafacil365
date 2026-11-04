import type { Article } from "../../types";

export const importContactsArticles: Article[] = [
  {
    id: "import-contacts-vcf-file",
    version: 1,
    title: "Como importar contatos por arquivo VCF",
    summary: "Envie um arquivo exportado do celular e transforme os contatos em clientes.",
    category: "clients",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/import-contacts",
    tourId: "import-contacts",
    steps: [
      {
        text: "Abra Importar Contatos, no grupo Relacionamento do menu. Se você exportou os contatos do celular, pode enviar o arquivo aqui. Ele costuma terminar com .vcf.",
        image: { src: "/training/import-contacts/vcf-card.webp", alt: "Opção Arquivo VCF", pending: true },
      },
      { text: "Clique em Arquivo VCF ou em Selecionar Arquivo e escolha o arquivo no seu aparelho." },
      { text: "O sistema lê nomes e telefones válidos. Contatos repetidos pelo telefone são juntados." },
      { text: "Confira a lista antes de importar. Desmarque contatos que não devem entrar no Agenda Fácil 365." },
      { text: "Clique em Importar Contatos. Os contatos selecionados serão salvos como clientes." },
    ],
    keywords: ["vcf", "arquivo", "contatos do celular", "exportei contatos", "importar agenda"],
  },
  {
    id: "import-contacts-phone-picker",
    version: 1,
    title: "Como importar contatos direto do celular",
    summary: "Em celulares compatíveis, selecione contatos sem criar arquivo.",
    category: "clients",
    difficulty: "médio",
    minutes: 4,
    route: "/admin/import-contacts",
    tourId: "import-contacts",
    steps: [
      {
        text: "Toque em Selecionar Contatos na opção Contatos do Celular.",
        image: { src: "/training/import-contacts/phone-card.webp", alt: "Opção Contatos do Celular", pending: true },
      },
      { text: "Se o navegador permitir, escolha os contatos que quer trazer para o Agenda Fácil 365." },
      { text: "Confira a lista carregada e deixe marcado só quem deve virar cliente." },
      { text: "Clique em Importar Contatos para salvar." },
    ],
    notes: ["Esse recurso depende do navegador. No código, ele verifica suporte ao recurso de contatos do aparelho e pode falhar em muitos navegadores, principalmente fora do Chrome para Android."],
    keywords: ["celular", "android", "agenda do telefone", "selecionar contatos", "navegador"],
  },
  {
    id: "import-contacts-whatsapp-evolution",
    version: 1,
    title: "Como importar contatos do WhatsApp",
    summary: "Importe do WhatsApp após preparar a conexão com ajuda do suporte.",
    category: "clients",
    difficulty: "avançado",
    minutes: 6,
    route: "/admin/import-contacts",
    tourId: "import-contacts",
    steps: [
      {
        text: "Conecte primeiro o WhatsApp do salão na tela WhatsApp. Depois abra Importar contatos e escolha Buscar contatos. Não é necessário informar chaves nesta tela.",
      },
      { text: "Clique em Buscar Contatos. O sistema tenta buscar contatos ligados a essa conexão." },
      { text: "Confira a lista encontrada e desmarque o que não quiser salvar." },
      { text: "Clique em Importar Contatos para gravar os selecionados como clientes." },
    ],
    notes: ["Este método é funcional no código, mas depende de uma conexão Evolution válida. Não ensine nem compartilhe chaves em treinamento."],
    keywords: ["whatsapp", "evolution", "buscar contatos", "zap", "conexão"],
  },
];
