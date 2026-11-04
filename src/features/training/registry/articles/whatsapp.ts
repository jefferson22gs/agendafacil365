import type { Article } from "../../types";

export const whatsappArticles: Article[] = [
  {
    id: "whatsapp-connect-number",
    version: 1,
    title: "Como conectar o WhatsApp do salão",
    summary: "Use o número de atendimento do salão e conecte pelo QR Code do celular.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/whatsapp",
    tourId: "whatsapp-connect",
    steps: [
      {
        text: "Abra a tela WhatsApp. Ela liga o número do salão ao sistema para liberar chatbot, Disparador de Mensagens e Agendador de Status.",
        image: { src: "/training/whatsapp/connection-status.webp", alt: "Tela de conexão do WhatsApp com status e botões principais", pending: true },
      },
      { text: "Use o WhatsApp de atendimento do salão, não um número pessoal. Você precisa ter o celular em mãos para escanear o QR Code." },
      { text: "Se ainda não houver conexão cadastrada, clique em Conectar WhatsApp e confirme em Criar conexão. O cadastro não envia mensagens." },
      {
        text: "Depois de criar, clique em Conectar. O sistema mostra um QR Code para parear o WhatsApp.",
        image: { src: "/training/whatsapp/qrcode.webp", alt: "QR Code para conectar o WhatsApp do salão", pending: true },
      },
      { text: "No celular, abra WhatsApp, entre em Dispositivos Conectados ou Aparelhos conectados, escolha conectar um aparelho e escaneie o QR Code da tela." },
      { text: "Aguarde o status mudar para Conectado. Se ficar aguardando por muito tempo, gere um novo QR Code e tente de novo." },
      { text: "Depois de conectar, configure o Chatbot IA ou use o Agendador de Status. Antes de usar campanhas, confira se os clientes autorizaram receber mensagens." },
    ],
    notes: [
      "Esta tela mostra campos técnicos como nome interno, token e webhook. Eles não devem ser compartilhados nem usados como instrução para o usuário copiar.",
      "A tela consulta o estado da conexão ao abrir e durante o pareamento. A consulta contém gravações de status e telefone; na carga inicial há uma limitação na atualização, por isso confira também o WhatsApp no celular.",
      "O chatbot real, o Disparador e o Agendador de Status precisam da conexão. Confirmações automáticas usam uma configuração de envio separada; o envio por WhatsApp dos lembretes ainda está incompleto, então conectar aqui não garante lembretes automáticos.",
    ],
    keywords: ["whatsapp", "zap", "conectar", "qr code", "celular", "número", "chatbot", "status", "disparador", "mensagem"],
  },
  {
    id: "whatsapp-fix-status",
    version: 1,
    title: "Como cuidar da conexão do WhatsApp",
    summary: "Entenda Conectado, Aguardando conexão, Desconectado, desconectar e excluir.",
    category: "whatsapp",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin/whatsapp",
    tourId: "whatsapp-status",
    steps: [
      { text: "Abra WhatsApp e confira o cartão de status. Conectado significa pronto; Aguardando conexão significa que falta parear; Desconectado significa que o sistema não está ligado ao número." },
      { text: "Se cair a conexão, verifique internet do celular e abra WhatsApp, Aparelhos conectados. Depois volte ao sistema e gere um novo QR Code pelo botão Conectar." },
      { text: "Use Desconectar somente quando quiser desligar o WhatsApp do sistema. Depois disso, chatbot, disparos e status automáticos podem parar." },
      { text: "Use Excluir Instância apenas quando quiser remover o cadastro da conexão. Para renovar QR Code, prefira Conectar ou Gerar novo QR Code." },
      {
        text: "Não compartilhe prints de QR Code, token ou dados técnicos da conexão. Se precisar de suporte, informe apenas o status mostrado na tela.",
        image: { src: "/training/whatsapp/status-actions.webp", alt: "Ações de status, reconectar, desconectar e excluir WhatsApp", pending: true },
      },
    ],
    notes: [
      "Desconectar e excluir alteram a conexão real. Os tours apenas explicam esses botões e não usam waitForClick neles.",
      "A tela chama a função de status ao carregar uma conexão existente e durante o pareamento, podendo gravar atualizações no banco.",
    ],
    keywords: ["caiu", "desconectou", "reconectar", "status", "excluir", "desconectar", "qr", "token", "instância"],
  },
];
