import type { Article } from "../../types";

const CONNECTION = "/admin/whatsapp?aba=conexao";

export const whatsappArticles: Article[] = [
  {
    id: "whatsapp-connect-number",
    version: 2,
    title: "Como conectar o WhatsApp do salão",
    summary: "Use o número de atendimento do salão e conecte pelo QR Code do celular.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 5,
    route: CONNECTION,
    tourId: "whatsapp-connect",
    steps: [
      {
        text: "Abra WhatsApp no menu e escolha a aba Conexão. Ela liga o número do salão ao sistema e libera Conversas, Disparador, Status e Chatbot.",
        image: { src: "/training/whatsapp/connection-status.webp", alt: "Aba Conexão com status e botões principais", pending: true },
      },
      { text: "Use o WhatsApp de atendimento do salão, não um número pessoal, e tenha o celular em mãos." },
      { text: "Se ainda não houver conexão, clique em Conectar WhatsApp e depois em Criar conexão. O cadastro não envia mensagens." },
      {
        text: "Com a conexão criada e desconectada, clique em Reconectar. O sistema mostra um QR Code.",
        image: { src: "/training/whatsapp/qrcode.webp", alt: "QR Code para conectar o WhatsApp do salão", pending: true },
      },
      { text: "No celular, abra o WhatsApp, entre em Aparelhos conectados, toque em Conectar aparelho e escaneie o código." },
      { text: "Aguarde aparecer WhatsApp conectado. Se o código vencer, use Gerar novo QR Code." },
      { text: "Depois, acompanhe a aba Conversas e configure o Chatbot. Antes de campanhas, confira se os clientes autorizaram receber mensagens." },
    ],
    notes: [
      "Cada salão tem sua própria conexão; mensagens não são compartilhadas com outros estabelecimentos.",
      "Não compartilhe prints do QR Code.",
    ],
    keywords: ["whatsapp", "zap", "conectar", "qr code", "celular", "número", "chatbot", "status", "disparador", "mensagem", "conexão"],
  },
  {
    id: "whatsapp-fix-status",
    version: 2,
    title: "Como cuidar da conexão do WhatsApp",
    summary: "Entenda conectado, aguardando, desconectado, desconectar e excluir.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 4,
    route: CONNECTION,
    tourId: "whatsapp-status",
    steps: [
      { text: "Na aba Conexão, confira o status: WhatsApp conectado significa pronto; Aguardando conexão, falta parear; WhatsApp desconectado, a ligação não está ativa." },
      { text: "Se cair, verifique a internet do celular e os Aparelhos conectados no WhatsApp. Depois use Reconectar e escaneie o novo QR Code." },
      { text: "Desconectar desliga o WhatsApp do sistema após confirmação. Mensagens automáticas param até reconectar." },
      { text: "Excluir conexão remove o cadastro após confirmação. Para renovar o QR Code, use Reconectar ou Gerar novo QR Code." },
      {
        text: "Se precisar de suporte, informe só o status mostrado. Não envie o QR Code.",
        image: { src: "/training/whatsapp/status-actions.webp", alt: "Ações de reconectar, desconectar e excluir conexão", pending: true },
      },
    ],
    notes: ["Desconectar e excluir alteram a conexão real. O tour só explica esses botões; nunca clica neles."],
    keywords: ["caiu", "desconectou", "reconectar", "status", "excluir", "desconectar", "qr", "conexão"],
  },
  {
    id: "whatsapp-inbox-attend",
    version: 1,
    title: "Como atender clientes na aba Conversas",
    summary: "Veja as conversas do WhatsApp, assuma o atendimento da IA e responda.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin/whatsapp?aba=conversas",
    tourId: "whatsapp-inbox",
    steps: [
      { text: "Abra WhatsApp no menu e escolha a aba Conversas. A lista atualiza sozinha e mostra as mensagens recebidas no número conectado." },
      { text: "Busque por nome ou telefone e filtre por Todos os atendimentos, IA respondendo / disponível ou Humano." },
      { text: "Abra uma conversa para ver as mensagens. Carregar anteriores mostra mensagens mais antigas; no celular, Voltar retorna à lista." },
      { text: "Assumir atendimento pausa a IA só nesse contato. Responder também assume a conversa. Devolver para IA pede confirmação." },
      { text: "Escreva e clique em Enviar resposta. Se aparecer Resultado incerto, confira no celular antes de enviar de novo." },
      { text: "Sincronizar histórico confere as mensagens recentes da conversa no WhatsApp. Não envia nada ao cliente." },
    ],
    notes: [
      "IA disponível não significa Chatbot ligado. Ligue ou desligue na aba Chatbot.",
      "Se o cliente pedir para falar com uma pessoa, a IA pausa sozinha naquele contato.",
    ],
    keywords: ["conversas", "inbox", "atendimento", "responder", "mensagens", "assumir", "humano", "zap", "whatsapp", "histórico"],
  },
];
