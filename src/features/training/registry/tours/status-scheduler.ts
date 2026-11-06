import type { TourDef } from "../../types";

export const statusSchedulerTour: TourDef = {
  id: "status-scheduler",
  version: 2,
  title: "Agendador de Status",
  description: "Agende textos, fotos e vídeos para o Status do WhatsApp.",
  category: "whatsapp",
  route: "/admin/whatsapp?aba=status",
  steps: [
    {
      target: "status-scheduler-header",
      title: "Status agendado",
      body: "A aba Status da central WhatsApp agenda publicações para o Status do WhatsApp do salão. Use para divulgar horários livres, promoções, antes e depois e avisos rápidos.",
    },
    {
      target: "status-scheduler-connection",
      title: "WhatsApp precisa estar conectado",
      body: "O status no topo mostra se a conexão está pronta. Se aparecer desconectado, conecte na aba Conexão; o botão Conectar WhatsApp do aviso abre essa aba.",
    },
    {
      target: "status-scheduler-new",
      mode: "waitForClick",
      title: "Criar um agendamento",
      body: "Clique em Agendar Post para abrir o formulário. Nada será publicado enquanto você não salvar um agendamento.",
    },
    {
      target: "status-scheduler-type",
      title: "Escolher o tipo",
      body: "Escolha Imagem, Vídeo ou Texto. Para salões, fotos de resultado e avisos curtos costumam funcionar melhor.",
      fallbackBody: "Abra o formulário em Agendar Post para escolher o tipo de conteúdo.",
    },
    {
      target: "status-scheduler-media",
      title: "Adicionar mídia",
      body: "Para imagem ou vídeo, selecione o arquivo. Confira se a foto está nítida e se o conteúdo pode ser publicado para os clientes.",
      fallbackBody: "No formulário, a área de mídia aparece quando o tipo não é Texto.",
    },
    {
      target: "status-scheduler-caption",
      title: "Legenda ou texto",
      body: "Escreva a mensagem do Status. Em imagens, você pode usar Gerar com IA, mas revise antes de salvar para manter o tom do salão.",
      fallbackBody: "O campo de legenda fica no formulário do post.",
    },
    {
      target: "status-scheduler-date-time",
      title: "Data e horário",
      body: "Escolha quando o Status deve sair. Prefira horários em que seus clientes costumam olhar o WhatsApp, como manhã e fim da tarde.",
      fallbackBody: "No formulário, defina a data e a hora da publicação.",
    },
    {
      target: "status-scheduler-recurrence",
      title: "Repetição",
      body: "Use recorrência para avisos frequentes. Se for uma promoção com data final, preencha o fim da recorrência para não publicar depois do prazo.",
      fallbackBody: "A recorrência fica no final do formulário de agendamento.",
    },
    {
      target: "status-scheduler-save",
      title: "Salvar agendamento",
      body: "Quando tudo estiver certo, clique em Agendar. O tour não salva nem publica por você.",
      fallbackBody: "O botão Agendar fica no rodapé do formulário.",
    },
    {
      target: "status-scheduler-cancel",
      mode: "info",
      title: "Sair sem criar um post",
      body: "Se está apenas conhecendo o formulário, feche-o sem salvar usando Cancelar. Para ver o calendário e a lista nos próximos passos, o formulário precisa estar fechado.",
      fallbackBody: "Se o formulário já está fechado, siga para o calendário. Cancelar fecha o formulário sem criar uma publicação.",
    },
    {
      target: "status-scheduler-calendar",
      title: "Calendário da semana",
      body: "A aba Calendário organiza os posts por dia e permite mudar a semana. Para conhecer o formulário de um post, use o lápis na Lista quando ele ainda não foi publicado.",
      fallbackBody: "Depois de salvar posts, eles aparecem no calendário da semana.",
    },
    {
      target: "status-scheduler-list-tab",
      mode: "waitForClick",
      title: "Ver tudo em lista",
      body: "Clique em Lista para acompanhar todos os posts agendados e os que já foram processados.",
    },
    {
      target: "status-scheduler-list",
      title: "Acompanhar resultados",
      body: "A lista mostra status como Agendado, Publicado ou Falhou. Se falhar, confira a conexão do WhatsApp e os dados do post.",
      fallbackBody: "Se ainda não há posts, a lista mostra um estado vazio com opção de agendar o primeiro.",
    },
    {
      title: "Pronto",
      body: "Antes de depender do agendamento, conecte o WhatsApp e faça um teste com um post simples. O processamento automático é feito por rotina do sistema.",
    },
  ],
};
