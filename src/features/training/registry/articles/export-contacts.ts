import type { Article } from "../../types";

export const exportContactsArticles: Article[] = [
  {
    id: "export-contacts-vcf",
    version: 2,
    title: "Como exportar clientes para contatos do celular",
    summary: "Baixe um arquivo VCF para usar sua lista como contatos.",
    category: "clients",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin/whatsapp?aba=contatos&contatos=exportar",
    tourId: "export-contacts",
    steps: [
      {
        text: "Abra WhatsApp no menu, escolha a aba Contatos e depois Exportar. Escolha VCF. Esse é o formato usado por agendas de celular.",
        image: { src: "/training/export-contacts/format-vcf.webp", alt: "Formato VCF selecionado", pending: true },
      },
      { text: "Confira a lista e deixe marcados os clientes que devem entrar no arquivo." },
      { text: "Clique em Exportar. O arquivo será baixado automaticamente." },
      { text: "Depois, importe esse arquivo no aplicativo de contatos do celular, se precisar." },
    ],
    notes: ["Clientes sem telefone entram no VCF sem linha de telefone, para a exportação não quebrar."],
    keywords: ["exportar", "vcf", "contatos", "celular", "baixar clientes"],
  },
  {
    id: "export-contacts-csv",
    version: 2,
    title: "Como exportar clientes para planilha",
    summary: "Baixe um CSV para abrir no Excel ou Google Sheets.",
    category: "clients",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin/whatsapp?aba=contatos&contatos=exportar",
    tourId: "export-contacts",
    steps: [
      {
        text: "Na aba Contatos, em Exportar, escolha CSV quando quiser abrir os clientes como planilha.",
        image: { src: "/training/export-contacts/format-csv.webp", alt: "Formato CSV selecionado", pending: true },
      },
      { text: "Marque os clientes que devem aparecer no arquivo. Use Selecionar Todos para agilizar." },
      { text: "Clique em Exportar. O arquivo será baixado com nome, telefone, e-mail, nascimento e data de cadastro." },
      { text: "Abra o arquivo no Excel, Google Sheets ou outro aplicativo de planilha." },
    ],
    keywords: ["csv", "planilha", "excel", "google sheets", "baixar lista", "clientes"],
  },
];
