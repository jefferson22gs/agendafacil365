import type { Article } from "../../types";

export const broadcastArticles: Article[] = [
  {
    id: "broadcast-send-responsibly",
    version: 2,
    title: "Como enviar mensagens em massa com responsabilidade",
    summary: "Monte o público, personalize com {nome}, envie ou agende e acompanhe a campanha.",
    category: "marketing",
    difficulty: "médio",
    minutes: 6,
    route: "/admin/whatsapp?aba=disparador",
    tourId: "broadcast",
    steps: [
      {
        text: "Abra WhatsApp no menu e escolha a aba Disparador. Ele exige WhatsApp conectado na aba Conexão.",
        image: { src: "/training/broadcast/main.webp", alt: "Aba Disparador com contatos, mensagem e histórico", pending: true },
      },
      { text: "Envie só para quem autorizou receber mensagens. Disparo para desconhecidos gera denúncias e pode bloquear o número." },
      { text: "Monte o público com Clientes do sistema, Contatos do WhatsApp, arquivo CSV/VCF ou números digitados. Repetidos, inválidos, grupos, listas e quem pediu para sair são ignorados." },
      { text: "Busque e marque os destinatários. Marcar visíveis seleciona todos os resultados da busca." },
      {
        text: "Escreva a mensagem (até 4096 caracteres) ou use um modelo salvo. {nome} vira o primeiro nome do cliente; confira a prévia.",
        image: { src: "/training/broadcast/message.webp", alt: "Campo de mensagem com prévia e modelos", pending: true },
      },
      { text: "Clique em Revisar envio. Na conferência, deixe a data vazia para enviar agora ou agende no fuso do salão. Confirme que os contatos autorizaram." },
      { text: "A fila envia 1 mensagem a cada 3 segundos. Campanhas grandes são registradas em lotes de 1000 sem duplicar, mesmo se você confirmar de novo após uma falha." },
      {
        text: "No Histórico, acompanhe enviadas, falhas e total. Ver destinatários mostra o status por pessoa; Parar pendentes interrompe o que ainda não saiu.",
        image: { src: "/training/broadcast/history.webp", alt: "Histórico e destinatários de uma campanha", pending: true },
      },
    ],
    notes: [
      "Verificar significa resultado incerto: confira no celular antes de reenviar.",
      "Se o WhatsApp desconectar, campanhas registradas continuam na fila e retomam após reconectar.",
    ],
    keywords: ["disparador", "campanha", "marketing", "mensagem", "whatsapp", "clientes", "contatos", "modelo", "envio em massa", "agendar", "bloqueio", "spam"],
  },
];
