import type { Article } from "../../types";

export const statusSchedulerArticles: Article[] = [
  {
    id: "status-scheduler-create-post",
    version: 1,
    title: "Como agendar um Status do WhatsApp",
    summary: "Crie um post de texto, foto ou vídeo para publicar automaticamente no Status.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/status-scheduler",
    tourId: "status-scheduler",
    steps: [
      {
        text: "Abra Agendador de Status. Ele serve para deixar posts prontos e publicar no Status do WhatsApp do salão no horário escolhido.",
        image: { src: "/training/status-scheduler/calendar.webp", alt: "Calendário do Agendador de Status", pending: true },
      },
      { text: "Confira o aviso de conexão. Se o WhatsApp estiver desconectado, abra WhatsApp no grupo Relacionamento do menu e conecte por lá. O botão Conectar WhatsApp do aviso leva direto para essa tela." },
      {
        text: "Clique em Agendar Post. Escolha Imagem, Vídeo ou Texto e selecione a mídia quando necessário.",
        image: { src: "/training/status-scheduler/new-dialog.webp", alt: "Formulário para agendar Status", pending: true },
      },
      { text: "Escreva a legenda ou o texto do Status. Se usar Gerar com IA, revise antes de salvar para evitar texto errado ou fora do tom do salão." },
      { text: "Defina data e hora. Use recorrência apenas para mensagens que podem se repetir sem ficar desatualizadas." },
      { text: "Clique em Agendar quando estiver tudo certo. O sistema grava o post como agendado; a publicação automática depende da rotina de processamento do sistema e da conexão WhatsApp." },
      {
        text: "Use a aba Lista para acompanhar status como Agendado, Publicado ou Falhou. Se falhar, confira a conexão e os dados do post.",
        image: { src: "/training/status-scheduler/list.webp", alt: "Lista de posts agendados com status", pending: true },
      },
    ],
    notes: [
      "O botão Conectar WhatsApp exibido no alerta desta tela abre a tela WhatsApp, onde a conexão é feita.",
      "Ao abrir, esta tela lê salons, whatsapp_instances e scheduled_posts. Não grava no banco até salvar, editar ou excluir um post.",
      "Gerar com IA usa uma chave Gemini ativa cadastrada no banco do Super Admin.",
    ],
    keywords: ["status", "whatsapp", "agendar", "post", "foto", "vídeo", "legenda", "stories", "publicar", "recorrência"],
  },
];
