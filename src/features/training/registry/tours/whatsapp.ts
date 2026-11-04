import type { TourDef } from "../../types";

export const whatsappConnectTour: TourDef = {
  id: "whatsapp-connect",
  version: 1,
  title: "Conectar o WhatsApp",
  description: "Prepare o número do salão, conecte pelo celular e confira a conexão.",
  category: "whatsapp",
  route: "/admin/whatsapp",
  steps: [
    {
      target: "whatsapp-header",
      title: "O WhatsApp do salão",
      body: "Esta tela liga o WhatsApp do salão ao sistema. A conexão é necessária para atender pelo chatbot, enviar pelo Disparador e publicar pelo Agendador de Status.",
    },
    {
      title: "Qual número usar?",
      body: "Use o número de atendimento do salão, com acesso ao WhatsApp no celular. Evite conectar um número pessoal: os clientes receberão as mensagens pelo número conectado.",
      tip: "Lembretes e confirmações por WhatsApp também dependem da configuração de envio. Só conectar aqui não garante que essas automações estejam prontas.",
    },
    {
      target: "whatsapp-create-button",
      mode: "waitForClick",
      title: "Preparar a conexão",
      body: "Se ainda não há conexão cadastrada, clique em Conectar WhatsApp. Isso só abre o cadastro da conexão do estabelecimento.",
      fallbackBody: "Se a conexão já está cadastrada, não precisa criar outra. Confira o status e use Conectar somente se estiver desconectada.",
    },
    {
      target: "whatsapp-create-save",
      title: "Criar quando estiver pronto",
      body: "O sistema cria uma conexão exclusiva; nenhuma mensagem é enviada neste cadastro. Quando decidir preparar a conexão, clique em Criar conexão; para só conhecer a tela, use Voltar.",
      fallbackBody: "A criação fica no formulário aberto pelo botão Conectar WhatsApp. Se já existe uma conexão cadastrada, pule esta etapa.",
    },
    {
      target: "whatsapp-connect-button",
      title: "Gerar o código de conexão",
      body: "Depois de criar, o botão Conectar gera o QR Code. Use-o apenas quando estiver com o celular do salão em mãos; o tour não conecta por você.",
      fallbackBody: "O botão Conectar aparece quando há uma conexão cadastrada que não está conectada. Se já estiver Conectado, não é preciso gerar outro código.",
    },
    {
      // Explica sem destacar um QR Code real (dado de conexão sensível).
      title: "Escanear pelo celular",
      body: "Abra o WhatsApp no celular do salão e entre em Dispositivos Conectados, também chamado de Aparelhos conectados. Escolha conectar um aparelho e aponte a câmera para o QR Code desta tela.",
      tip: "Não envie prints desse código a outras pessoas.",
      fallbackBody: "O QR Code aparece após usar Conectar. No celular do salão, abra WhatsApp, Aparelhos conectados e Conectar um aparelho para escanear o código.",
    },
    {
      target: "whatsapp-new-qrcode",
      title: "Se o código não funcionar",
      body: "Se o QR Code vencer ou não carregar, você pode usar Gerar novo QR Code e escanear novamente. Não é necessário excluir a conexão só para renovar o código.",
      fallbackBody: "Enquanto o sistema mostra a área do QR Code, há a opção Gerar novo QR Code. Se já estiver conectado, essa etapa não é necessária.",
    },
    {
      target: "whatsapp-status",
      title: "Confirmar que conectou",
      body: "Aguarde o status mudar para Conectado. Aguardando conexão significa que ainda falta concluir o pareamento no celular; Desconectado significa que a ligação não está ativa.",
      fallbackBody: "Depois de cadastrar a conexão, aparece o status. Só considere concluído quando ele mostrar Conectado.",
    },
    {
      title: "Próximo passo",
      body: "Com o WhatsApp conectado, configure o Chatbot IA ou prepare um Status. Antes de enviar qualquer campanha, confira os destinatários e peça autorização para receber mensagens.",
    },
  ],
};

export const whatsappStatusTour: TourDef = {
  id: "whatsapp-status",
  version: 1,
  title: "Cuidar da conexão WhatsApp",
  description: "Entenda o status, a reconexão e as opções de desligar ou excluir.",
  category: "whatsapp",
  route: "/admin/whatsapp",
  steps: [
    {
      target: "whatsapp-header",
      title: "Acompanhar a conexão",
      body: "Esta tela ajuda a conferir se o WhatsApp do salão está ligado ao sistema. Se a conexão cair, o chatbot, o Disparador e os Status podem deixar de funcionar.",
    },
    {
      target: "whatsapp-status",
      title: "Ler o status",
      body: "Conectado indica ligação ativa; Aguardando conexão indica pareamento pendente. Se aparecer Desconectado, verifique a internet e os aparelhos conectados no WhatsApp do celular.",
      fallbackBody: "Se ainda não existe conexão cadastrada, aparece a opção de criar uma. Faça primeiro o guia Conectar o WhatsApp.",
    },
    {
      target: "whatsapp-connect-button",
      title: "Se a conexão cair",
      body: "Quando quiser reconectar, use Conectar e escaneie o QR Code pelo celular do salão. Se o status parecer antigo, confira os aparelhos conectados no celular e peça ajuda ao suporte.",
      fallbackBody: "Se estiver conectado, não há botão Conectar. Caso a conexão caia, ele volta a aparecer para gerar outro QR Code.",
    },
    {
      target: "whatsapp-disconnect",
      title: "Desligar sem excluir o cadastro",
      body: "Desconectar desliga o WhatsApp do sistema e interrompe o uso dessa conexão. Use apenas se realmente quiser parar; depois será necessário reconectar.",
      fallbackBody: "O botão Desconectar só aparece quando o WhatsApp está conectado. Ele desliga a conexão sem remover o cadastro.",
    },
    {
      target: "whatsapp-delete",
      title: "Excluir é diferente de desconectar",
      body: "Excluir Instância remove o cadastro da conexão após uma confirmação. Não faça isso apenas para renovar um QR Code: para voltar a usar, será preciso criar e conectar novamente.",
      fallbackBody: "Excluir Instância aparece quando há uma conexão cadastrada. É uma remoção, não uma simples consulta de status.",
    },
    {
      title: "Manter o atendimento funcionando",
      body: "Confira a conexão antes de contar com mensagens automáticas. Se a reconexão não resolver, procure o suporte sem compartilhar códigos de conexão nem informações sigilosas.",
    },
  ],
};
