import type { TourDef } from "../../types";

export const broadcastTour: TourDef = {
  id: "broadcast",
  version: 2,
  title: "Disparador de mensagens",
  description: "Monte o público, escreva a mensagem, envie ou agende e acompanhe a campanha.",
  category: "marketing",
  route: "/admin/whatsapp?aba=disparador",
  steps: [
    {
      target: "broadcast-header",
      title: "Disparador",
      body: "Envia uma mensagem para vários contatos pelo WhatsApp do salão. O envio vai para uma fila, 1 mensagem a cada 3 segundos. Quem pediu para sair é ignorado automaticamente.",
      tip: "Se aparecer WhatsApp desconectado, conecte primeiro na aba Conexão. Campanhas já registradas retomam após reconectar.",
    },
    {
      target: "broadcast-load-contacts",
      title: "Clientes do sistema",
      body: "Carrega os clientes cadastrados com telefone. Eles entram na lista sem marcação: escolha quem recebe.",
      fallbackBody: "Conecte o WhatsApp na aba Conexão para montar o público.",
    },
    {
      target: "broadcast-evolution",
      title: "Contatos do WhatsApp",
      body: "Busca os contatos do WhatsApp conectado. Grupos, listas, canais e contatos sem número ficam de fora. Também dá para usar arquivo CSV/VCF ou digitar números.",
      fallbackBody: "Com o WhatsApp conectado, você também pode buscar contatos do celular, enviar arquivo CSV/VCF ou digitar números.",
    },
    {
      target: "broadcast-search",
      title: "Buscar destinatário",
      body: "Filtre por nome ou telefone. Marcar visíveis seleciona todos os resultados da busca.",
      fallbackBody: "A busca aparece com o WhatsApp conectado.",
    },
    {
      target: "broadcast-contact-list",
      title: "Escolher quem recebe",
      body: "Marque só quem autorizou receber mensagens. Números repetidos, inválidos ou que pediram para sair são ignorados; o botão de ignorados mostra o motivo.",
      fallbackBody: "A lista aparece depois de carregar contatos.",
    },
    {
      target: "broadcast-message",
      title: "Escrever a mensagem",
      body: "Até 4096 caracteres. Use {nome} para trocar pelo primeiro nome do cliente e confira a prévia. Você pode usar ou salvar um modelo.",
      fallbackBody: "O campo de mensagem aparece com o WhatsApp conectado.",
    },
    {
      target: "broadcast-send",
      title: "Revisar envio",
      body: "Abre a conferência da campanha. Nada é enviado neste botão; o tour não clica por você.",
      fallbackBody: "Revisar envio fica ativo com destinatários marcados e mensagem válida.",
    },
    {
      target: "broadcast-schedule",
      title: "Enviar agora ou agendar",
      body: "Na conferência, deixe a data vazia para enviar agora ou escolha data e hora no fuso do salão. Confirme que os contatos autorizaram e clique em Confirmar envio ou Confirmar agendamento.",
      fallbackBody: "Ao clicar em Revisar envio, a conferência permite agendar data e hora no fuso do salão ou deixar vazio para enviar agora. É preciso confirmar que os contatos autorizaram.",
    },
    {
      target: "broadcast-history",
      title: "Histórico",
      body: "Mostra as 10 campanhas mais recentes com enviadas, falhas e total. Parar pendentes interrompe o que ainda não saiu; mensagens já aceitas não voltam.",
      fallbackBody: "O histórico aparece com o WhatsApp conectado.",
    },
    {
      target: "broadcast-details-button",
      title: "Ver destinatários",
      body: "Mostra o status de cada pessoa. Verificar significa resultado incerto: não reenvie sem conferir.",
      fallbackBody: "Depois da primeira campanha, cada item do histórico tem Ver destinatários.",
    },
  ],
};
