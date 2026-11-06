import type { TourDef } from "../../types";

export const exportContactsTour: TourDef = {
  id: "export-contacts",
  version: 2,
  title: "Exportar contatos",
  description: "Baixe sua lista de clientes em arquivo VCF ou CSV.",
  category: "clients",
  route: "/admin/whatsapp?aba=contatos&contatos=exportar",
  steps: [
    {
      target: "export-contacts-header",
      title: "Exportar clientes",
      body: "Na aba Contatos da central WhatsApp, em Exportar, você baixa seus clientes em arquivo. É útil para guardar uma cópia ou usar em outro lugar.",
    },
    {
      target: "export-contacts-format",
      title: "Escolha o formato",
      body: "VCF é melhor para contatos de celular. CSV é melhor para abrir como planilha no Excel ou Google Sheets.",
    },
    {
      target: "export-contacts-select-all",
      title: "Selecionar todos ou limpar",
      body: "Use este botão para marcar todos os clientes ou desmarcar todos de uma vez.",
      fallbackBody: "Quando houver clientes cadastrados, este botão aparece no topo da lista.",
    },
    {
      target: "export-contacts-list",
      title: "Escolha os clientes",
      body: "Marque somente os clientes que devem entrar no arquivo. Clicar na linha também marca ou desmarca.",
      fallbackBody: "Quando houver clientes cadastrados, a lista aparece aqui.",
    },
    {
      target: "export-contacts-download",
      title: "Baixar arquivo",
      body: "Quando estiver pronto, clique em Exportar. O arquivo será baixado no computador ou celular.",
    },
    {
      title: "Pronto!",
      body: "Guarde o arquivo em local seguro, porque ele contém dados de clientes.",
    },
  ],
};
