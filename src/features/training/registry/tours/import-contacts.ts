import type { TourDef } from "../../types";

export const importContactsTour: TourDef = {
  id: "import-contacts",
  version: 2,
  title: "Importar contatos",
  description: "Traga contatos para a lista de clientes por arquivo, celular ou WhatsApp.",
  category: "clients",
  route: "/admin/whatsapp?aba=contatos&contatos=importar",
  steps: [
    {
      target: "import-contacts-header",
      title: "Importação de contatos",
      body: "Na aba Contatos da central WhatsApp, em Importar, você traz vários contatos de uma vez e confere a prévia antes de salvar. Importar não significa autorização para marketing.",
    },
    {
      target: "import-contacts-vcf",
      title: "Arquivo VCF ou CSV",
      body: "Envie o arquivo exportado do celular (.vcf) ou uma planilha (.csv) de até 5 MB. No CSV, você escolhe qual coluna é nome, telefone e e-mail.",
    },
    {
      target: "import-contacts-phone",
      title: "Contatos do celular",
      body: "Em navegadores compatíveis, como Chrome no Android, você escolhe contatos direto da agenda. Se não funcionar, use o arquivo VCF.",
    },
    {
      target: "import-contacts-whatsapp",
      title: "WhatsApp do estabelecimento",
      body: "Busca os contatos do WhatsApp conectado na aba Conexão. Grupos e status não entram como clientes.",
    },
    {
      target: "import-contacts-preview",
      title: "Conferir a prévia",
      body: "Cada contato aparece como Novo, Já cadastrado, Repetido no arquivo ou Inválido. Só os novos podem ser marcados. Use a busca e Selecionar novos.",
      fallbackBody: "A prévia aparece depois de carregar contatos por algum método.",
    },
    {
      target: "import-contacts-save",
      title: "Importar selecionados",
      body: "Clique só quando a lista estiver certa e confirme. Os selecionados viram clientes; repetir a importação não duplica ninguém.",
      fallbackBody: "O botão de importar aparece abaixo da prévia.",
    },
    {
      target: "import-contacts-results",
      title: "Resultado",
      body: "Mostra quantos contatos foram importados e quantos já estavam cadastrados.",
      fallbackBody: "Depois de importar, o resultado aparece no topo da prévia.",
    },
    {
      title: "Pronto!",
      body: "Confira os clientes na tela Clientes para ajustar nomes e telefones.",
    },
  ],
};
