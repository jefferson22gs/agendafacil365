import type { TourDef } from "../../types";

export const servicesTour: TourDef = {
  id: "services",
  version: 1,
  title: "Serviços",
  description: "Cadastre o que seu salão oferece, com preço e duração.",
  category: "start",
  route: "/admin/services",
  steps: [
    {
      target: "services-header",
      title: "Seus serviços",
      body: "Aqui ficam os serviços que o salão oferece. São eles que o cliente escolhe ao agendar pelo seu link.",
    },
    {
      target: "services-new-button",
      mode: "waitForClick",
      title: "Cadastrar um serviço",
      body: "Clique em \"Novo Serviço\" para abrir o formulário. Nada é salvo até você clicar em Adicionar.",
    },
    {
      target: "services-icon",
      title: "Escolha um ícone",
      body: "O ícone ajuda o cliente a reconhecer o serviço na página de agendamento. Use as abas (Cabelo, Unhas, Estética, Saúde, Pet…) para achar o do seu ramo.",
      fallbackBody: "Abra o formulário em \"Novo Serviço\" para ver os campos.",
    },
    {
      target: "services-name",
      title: "Nome do serviço",
      body: "Use o nome que seus clientes conhecem, por exemplo \"Corte Feminino\" ou \"Escova\".",
      fallbackBody: "No formulário, informe o nome do serviço, por exemplo \"Corte Feminino\".",
    },
    {
      target: "services-price-duration",
      title: "Preço e duração",
      body: "O preço aparece para o cliente. A duração define quanto tempo o horário fica ocupado na agenda.",
      tip: "Duração errada causa horários encavalados. Inclua o tempo de preparo.",
      fallbackBody: "No formulário, informe preço e duração em minutos.",
    },
    {
      target: "services-save",
      title: "Salvar",
      body: "Quando terminar, clique em Adicionar. Se preferir só conhecer, clique em Cancelar: nada é alterado.",
      fallbackBody: "Ao terminar o formulário, clique em Adicionar para salvar.",
    },
    {
      target: "services-list",
      title: "Lista de serviços",
      body: "Cada cartão mostra preço e duração. Use o lápis para editar e a lixeira para excluir.",
      fallbackBody: "Depois do primeiro cadastro, seus serviços aparecem aqui em cartões, com opções de editar e excluir.",
    },
    {
      title: "Pronto!",
      body: "Com serviços cadastrados, o próximo passo é cadastrar quem atende: os profissionais.",
    },
  ],
};
