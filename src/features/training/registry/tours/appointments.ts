import type { TourDef } from "../../types";

export const appointmentsTour: TourDef = {
  id: "appointments",
  version: 2,
  title: "Agendamentos",
  description: "Veja a agenda do dia, crie horários e acompanhe o status dos atendimentos.",
  category: "agenda",
  route: "/admin/appointments",
  steps: [
    {
      target: "appointments-header",
      title: "Sua agenda",
      body: "Aqui você acompanha os horários do salão. Use esta tela todo dia para saber quem vem, em qual horário e com qual profissional.",
    },
    {
      target: "appointments-new-button",
      title: "Novo agendamento",
      body: "Use \"Novo Agendamento\" para marcar um cliente pelo painel. Existe um tour separado que ensina o formulário passo a passo.",
    },
    {
      target: "appointments-list-tab",
      title: "Lista do dia",
      body: "Esta aba mostra os agendamentos da data escolhida em formato de lista. É boa para conferir nomes, telefones e valores.",
    },
    {
      target: "appointments-pending",
      title: "Aguardando sua confirmação",
      body: "No modo de confirmação manual, os pedidos do link público e do WhatsApp chegam como Pendente. Este aviso mostra quantos são no dia e permite Confirmar todos ou Recusar todos. Cada cartão pendente também tem Confirmar e Recusar.",
      fallbackBody: "Quando houver agendamentos pendentes no dia, aparece aqui o aviso Aguardando sua confirmação, com Confirmar e Recusar.",
      tip: "O cliente recebe a mensagem de confirmado só quando você confirma. No modo automático, os pedidos já chegam confirmados.",
    },
    {
      target: "appointments-date-navigation",
      title: "Trocar a data",
      body: "Use as setas ou o campo de data para ver outro dia. A lista muda conforme a data escolhida.",
    },
    {
      target: "appointments-list",
      title: "Agendamentos encontrados",
      body: "Cada cartão mostra horário, cliente, serviço, profissional, telefone, status e valor.",
      fallbackBody: "Quando houver agendamentos nesta data, eles aparecem aqui em cartões.",
    },
    {
      target: "appointments-status",
      title: "Status do atendimento",
      body: "O status ajuda a separar pendentes, confirmados, concluídos, cancelados e clientes que não vieram.",
      fallbackBody: "Quando houver um agendamento, o status aparece no lado direito do cartão.",
    },
    {
      target: "appointments-actions",
      title: "Ações do agendamento",
      body: "Abra os três pontinhos para mudar o status ou entrar em contato. O tour não altera status por você.",
      fallbackBody: "Quando houver um agendamento, os três pontinhos aparecem no cartão dele.",
    },
    {
      target: "appointments-calendar-tab",
      mode: "waitForClick",
      title: "Agenda completa",
      body: "Clique em \"Agenda Completa\" para ver os horários do dia em grade. Ela ajuda a enxergar buracos na agenda.",
    },
    {
      target: "appointments-calendar",
      title: "Grade de horários",
      body: "Aqui aparecem os horários abertos e ocupados do dia. Um horário livre pode ser usado para criar um agendamento.",
      fallbackBody: "A grade aparece na aba \"Agenda Completa\".",
    },
    {
      title: "Pronto!",
      body: "Use a lista para acompanhar o dia e a agenda completa para encaixar horários. Para treinar o cadastro passo a passo, abra o tour \"Criar agendamento\".",
    },
  ],
};

export const appointmentsNewTour: TourDef = {
  id: "appointments-new",
  version: 1,
  title: "Criar agendamento",
  description: "Aprenda a preencher cliente, serviço, profissional, data e horário.",
  category: "agenda",
  route: "/admin/appointments",
  steps: [
    {
      target: "appointments-new-button",
      mode: "waitForClick",
      title: "Comece pelo botão",
      body: "Clique em \"Novo Agendamento\". O tour só abre o caminho; ele não salva nada sozinho.",
    },
    {
      target: "appointments-new-client",
      title: "Cliente",
      body: "Digite o nome do cliente como você quer ver na agenda. O telefone é opcional nesta tela, mas ajuda no contato.",
      fallbackBody: "Abra o formulário em \"Novo Agendamento\" para preencher o cliente.",
    },
    {
      target: "appointments-new-service",
      title: "Serviço",
      body: "Escolha o serviço que será feito. O preço e a duração vêm do cadastro de serviços.",
      fallbackBody: "No formulário, escolha o serviço do atendimento.",
    },
    {
      target: "appointments-new-professional",
      title: "Profissional",
      body: "Escolha quem vai atender. Se a lista estiver vazia, cadastre profissionais antes.",
      fallbackBody: "No formulário, escolha o profissional responsável.",
    },
    {
      target: "appointments-new-date",
      title: "Data",
      body: "Confira a data antes de salvar. O formulário começa com a data de hoje, mesmo que você tenha consultado outro dia na agenda.",
      fallbackBody: "No formulário, escolha a data do atendimento.",
    },
    {
      target: "appointments-new-time",
      title: "Horário",
      body: "Escolha o horário de início. O sistema calcula o fim usando a duração do serviço.",
      fallbackBody: "No formulário, escolha o horário do atendimento.",
    },
    {
      target: "appointments-new-save",
      title: "Salvar quando estiver certo",
      body: "Quando tudo estiver conferido, clique em \"Criar\". Se estiver apenas treinando, feche ou cancele.",
      fallbackBody: "O botão \"Criar\" fica no rodapé do formulário.",
    },
    {
      title: "Agendamento criado",
      body: "Depois de salvar, o horário aparece na lista da data. Acompanhe pelo status do atendimento.",
    },
  ],
};
