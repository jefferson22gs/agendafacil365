import type { TourDef } from "../../types";

const CONNECTION = "/admin/whatsapp?aba=conexao";
const INBOX = "/admin/whatsapp?aba=conversas";

export const whatsappConnectTour: TourDef = {
  id: "whatsapp-connect",
  version: 2,
  title: "Conectar o WhatsApp",
  description: "Prepare o número do salão, conecte pelo celular e confira a conexão.",
  category: "whatsapp",
  route: CONNECTION,
  steps: [
    {
      target: "whatsapp-central-tabs",
      title: "Central WhatsApp",
      body: "Tudo do WhatsApp fica nesta central: Conversas, Disparador, Status, Chatbot, Contatos e Conexão. Este guia usa a aba Conexão.",
    },
    {
      target: "whatsapp-header",
      title: "O WhatsApp do salão",
      body: "A aba Conexão liga o WhatsApp do salão ao sistema. Sem ela, Conversas, Disparador, Status e Chatbot não funcionam.",
    },
    {
      target: "whatsapp-official",
      title: "Conexão oficial da Meta",
      body: "Conectar WhatsApp oficial abre o cadastro da Meta. Manter o aplicativo Business depende da elegibilidade para coexistência; Usar um número novo é uma opção separada. O tour não conecta nem altera a conta. Os passos seguintes de QR Code servem apenas para Evolution.",
      fallbackBody: "A conexão oficial usa o cadastro da Meta, não o QR Code da Evolution. Confira com o suporte a disponibilidade para sua conta.",
    },
    {
      title: "Qual número usar?",
      body: "Use o número de atendimento do salão, com o celular em mãos. Evite número pessoal: os clientes recebem as mensagens pelo número conectado.",
    },
    {
      target: "whatsapp-create-button",
      mode: "waitForClick",
      title: "Preparar a conexão",
      body: "Se ainda não há conexão, clique em Conectar WhatsApp. Isso só abre o cadastro; nada é enviado.",
      fallbackBody: "A conexão já está cadastrada. Não crie outra: confira o status abaixo.",
    },
    {
      target: "whatsapp-create-save",
      title: "Criar quando estiver pronto",
      body: "O sistema cria uma conexão exclusiva do salão, sem enviar mensagens. Clique em Criar conexão quando decidir; para só conhecer a tela, use Voltar.",
      fallbackBody: "A criação fica no formulário aberto por Conectar WhatsApp. Se a conexão já existe, pule esta etapa.",
    },
    {
      target: "whatsapp-connect-button",
      title: "Gerar o QR Code",
      body: "Com a conexão criada e ainda desconectada, o botão Reconectar gera o QR Code. Use com o celular do salão em mãos; o tour não conecta por você.",
      fallbackBody: "O botão Reconectar aparece quando a conexão existe mas não está conectada. Se já estiver conectado, não precisa de outro código.",
    },
    {
      // Explica sem destacar o QR Code real (dado de conexão sensível).
      title: "Escanear pelo celular",
      body: "No celular do salão, abra o WhatsApp, entre em Aparelhos conectados, toque em Conectar aparelho e aponte a câmera para o QR Code da tela.",
      tip: "Não envie prints desse código a ninguém.",
    },
    {
      target: "whatsapp-new-qrcode",
      title: "Se o código vencer",
      body: "Se o QR Code vencer ou não ler, use Gerar novo QR Code e escaneie de novo. Não exclua a conexão só para renovar o código.",
      fallbackBody: "Gerar novo QR Code aparece junto do código. Se já estiver conectado, esta etapa não é necessária.",
    },
    {
      target: "whatsapp-status",
      title: "Confirmar que conectou",
      body: "Aguarde o título mudar para WhatsApp conectado. Aguardando conexão indica pareamento pendente; WhatsApp desconectado indica que a ligação não está ativa. O botão de atualizar consulta o status de novo.",
      fallbackBody: "O status aparece depois de cadastrar a conexão. Só considere concluído quando mostrar WhatsApp conectado.",
    },
    {
      title: "Próximo passo",
      body: "Com o WhatsApp conectado, acompanhe a aba Conversas, configure o Chatbot ou prepare um Status. Antes de campanhas, confira se os clientes autorizaram receber mensagens.",
    },
  ],
};

export const whatsappStatusTour: TourDef = {
  id: "whatsapp-status",
  version: 2,
  title: "Cuidar da conexão WhatsApp",
  description: "Entenda o status, a reconexão e as opções de desconectar ou excluir.",
  category: "whatsapp",
  route: CONNECTION,
  steps: [
    {
      target: "whatsapp-header",
      title: "Acompanhar a conexão",
      body: "Confira aqui se o WhatsApp do salão está ligado ao sistema. Se a conexão cair, Conversas, Disparador, Status e Chatbot param de enviar.",
    },
    {
      target: "whatsapp-status",
      title: "Ler o status",
      body: "WhatsApp conectado indica ligação ativa; Aguardando conexão, pareamento pendente; WhatsApp desconectado, ligação inativa. Nesse caso, verifique a internet e os aparelhos conectados no celular.",
      fallbackBody: "Ainda não existe conexão cadastrada. Faça primeiro o guia Conectar o WhatsApp.",
    },
    {
      target: "whatsapp-connect-button",
      title: "Se a conexão cair",
      body: "Use Reconectar e escaneie o novo QR Code pelo celular do salão.",
      fallbackBody: "Reconectar só aparece quando o WhatsApp não está conectado.",
    },
    {
      target: "whatsapp-disconnect",
      title: "Desconectar sem excluir",
      body: "Desconectar desliga o WhatsApp do sistema após confirmação, mantendo o cadastro. Mensagens automáticas param até reconectar.",
      fallbackBody: "Desconectar só aparece quando o WhatsApp está conectado. Ele desliga a conexão sem remover o cadastro.",
    },
    {
      target: "whatsapp-delete",
      title: "Excluir é diferente de desconectar",
      body: "Excluir conexão remove o cadastro após confirmação. Para voltar a usar, será preciso criar e conectar de novo. Não use isso só para renovar o QR Code.",
      fallbackBody: "Excluir conexão aparece quando há uma conexão cadastrada.",
    },
    {
      target: "whatsapp-tips",
      title: "Manter funcionando",
      body: "Confira o status antes de contar com automações. Se reconectar não resolver, procure o suporte sem compartilhar o QR Code.",
    },
  ],
};

export const whatsappInboxTour: TourDef = {
  id: "whatsapp-inbox",
  version: 2,
  title: "Atender pela aba Conversas",
  description: "Acompanhe mensagens, assuma o atendimento da IA e responda clientes.",
  category: "whatsapp",
  route: INBOX,
  steps: [
    {
      target: "inbox-header",
      title: "Conversas do WhatsApp",
      body: "Aqui aparecem as conversas recebidas no WhatsApp conectado, inclusive as atendidas pelo Chatbot. A lista atualiza sozinha. IA disponível não significa Chatbot ligado: confira a aba Chatbot.",
    },
    {
      target: "inbox-search",
      title: "Buscar contato",
      body: "Procure pelo nome ou número do cliente.",
    },
    {
      target: "inbox-filter",
      title: "Filtrar atendimentos",
      body: "Veja todos, só os que a IA está respondendo ou só os assumidos por uma pessoa da equipe.",
    },
    {
      target: "inbox-list",
      title: "Lista de conversas",
      body: "Toque numa conversa para abrir as mensagens. As mais recentes ficam no topo.",
      fallbackBody: "A lista fica vazia até chegar a primeira mensagem no WhatsApp conectado.",
    },
    {
      target: "inbox-thread",
      title: "Mensagens",
      body: "Mostra o histórico da conversa. Embaixo de cada mensagem enviada aparece o status: Na fila, Enviada ao WhatsApp (um tique: aceita, ainda não confirmada no celular), Entregue (dois tiques), Lida (dois tiques azuis) ou Falhou, com o motivo e o botão Tentar de novo.",
      fallbackBody: "Abra uma conversa da lista para ver as mensagens.",
    },
    {
      target: "inbox-takeover",
      title: "Assumir ou devolver para a IA",
      body: "Assumir atendimento pausa a IA só nesse contato. Devolver para IA pede confirmação e volta a deixar o Chatbot responder. Se o cliente pedir uma pessoa, a IA pausa sozinha.",
      fallbackBody: "Abra uma conversa para ver os botões Assumir atendimento e Devolver para IA.",
    },
    {
      target: "inbox-reply",
      title: "Responder",
      body: "Escreva e clique em Enviar resposta. Responder também assume a conversa e pausa a IA nesse contato. Se aparecer Resultado incerto, confira no celular antes de repetir.",
      fallbackBody: "Abra uma conversa para responder ao cliente.",
    },
    {
      target: "inbox-sync",
      title: "Sincronizar histórico",
      body: "Confere no WhatsApp conectado as mensagens recentes desta conversa e traz as que faltarem. Não envia nada ao cliente.",
      fallbackBody: "Abra uma conversa para ver o botão Sincronizar histórico.",
    },
  ],
};
