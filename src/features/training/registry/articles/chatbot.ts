import type { Article } from "../../types";

const ROUTE = "/admin/whatsapp?aba=chatbot";

export const chatbotArticles: Article[] = [
  {
    id: "chatbot-configure-first-time",
    version: 2,
    title: "Como configurar o Chatbot IA",
    summary: "Ative o atendimento automático, personalize mensagens e defina horários.",
    category: "ai",
    difficulty: "fácil",
    minutes: 5,
    route: ROUTE,
    tourId: "chatbot-setup",
    steps: [
      {
        text: "Abra WhatsApp no menu e escolha a aba Chatbot. Ela controla o atendimento automático que responde mensagens recebidas no WhatsApp conectado.",
        image: { src: "/training/chatbot/settings.webp", alt: "Aba Chatbot com configurações do assistente", pending: true },
      },
      { text: "A IA é fornecida pelo sistema. Não há provedor, modelo ou chave para escolher nesta tela." },
      { text: "Deixe o chatbot desligado enquanto configura. Ligue somente depois de salvar, testar e conectar o WhatsApp do salão." },
      { text: "Ajuste o nome do assistente e a mensagem de fallback, usada quando a IA não consegue responder. O campo Boas-vindas é salvo, mas não é enviado automaticamente no atendimento atual." },
      { text: "Defina os dias e horários em que a IA pode responder. Fora do horário, o cliente recebe a mensagem de fora do horário." },
      { text: "Clique em Salvar Configurações. O tour não salva nem liga o atendimento por você." },
    ],
    notes: [
      "O selo Ativo reflete o ajuste da tela, não confirma a conexão do WhatsApp.",
      "Com o chatbot desligado, mensagens recebidas continuam aparecendo na aba Conversas, mas a IA não responde.",
      "Se o cliente pedir para falar com uma pessoa, a IA pausa sozinha naquele contato. A equipe pode assumir ou devolver o atendimento na aba Conversas.",
    ],
    keywords: ["chatbot", "ia", "robô", "atendente", "configurar", "horário", "resposta automática", "assistente"],
  },
  {
    id: "chatbot-train-knowledge",
    version: 2,
    title: "Como treinar o Chatbot com informações do salão",
    summary: "Edite as orientações e cadastre perguntas frequentes para respostas mais corretas.",
    category: "ai",
    difficulty: "médio",
    minutes: 5,
    route: ROUTE,
    tourId: "chatbot-knowledge",
    steps: [
      {
        text: "Na aba Chatbot, abra Treinamento. A orientação principal define o jeito de falar da IA e as regras gerais de atendimento.",
        image: { src: "/training/chatbot/training.webp", alt: "Aba Treinamento com orientação e base de conhecimento", pending: true },
      },
      { text: "Escreva orientações como: seja objetiva, peça os dados necessários e chame a equipe em casos difíceis. As regras de segurança do sistema sempre valem, mesmo que o texto diga outra coisa." },
      { text: "Use Instruções Personalizadas para informações do salão: endereço, políticas, formas de pagamento e regras de atraso. Clique em Salvar Prompt para guardar; o botão também salva os outros ajustes alterados na tela." },
      { text: "Na Base de Conhecimento, cadastre perguntas e respostas frequentes, como estacionamento, localização e cuidados após o atendimento, e clique em Adicionar ao Conhecimento." },
      { text: "Revise a lista com frequência. Remova itens desatualizados pela lixeira e cadastre a versão nova." },
    ],
    notes: [
      "Preços, serviços e horários livres são consultados no cadastro e na agenda do salão; mantenha esses cadastros corretos.",
      "A IA usa até 20 itens ativos da base de conhecimento.",
      "Adicionar e excluir conhecimento grava na hora. O tour apenas explica as ações.",
    ],
    keywords: ["treinar", "conhecimento", "prompt", "perguntas", "respostas", "faq", "informações", "salão"],
  },
  {
    id: "chatbot-test-safely",
    version: 2,
    title: "Como testar o Chatbot com segurança",
    summary: "Converse com a IA real na aba Testar sem enviar nada a clientes.",
    category: "ai",
    difficulty: "fácil",
    minutes: 3,
    route: ROUTE,
    tourId: "chatbot-test",
    steps: [
      { text: "Salve as configurações e o treinamento antes: o teste usa o que está salvo." },
      {
        text: "Na aba Chatbot, abra Testar e digite perguntas comuns de clientes, como preço, horário, endereço e como agendar.",
        image: { src: "/training/chatbot/test.webp", alt: "Aba Testar com conversa de teste do chatbot", pending: true },
      },
      { text: "A resposta vem da mesma IA do atendimento real, mas nada é enviado pelo WhatsApp, nenhuma conversa é gravada e nenhum agendamento é criado ou alterado." },
      { text: "O teste funciona mesmo com o chatbot desligado e fora do horário de atendimento, para você ajustar com calma." },
      { text: "Depois de ativar, acompanhe as primeiras conversas reais na aba Conversas." },
    ],
    keywords: ["testar", "simulação", "teste", "mensagem", "resposta", "ia"],
  },
];
