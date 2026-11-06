import type { TourDef } from "../../types";

const ROUTE = "/admin/whatsapp?aba=chatbot";

export const chatbotSetupTour: TourDef = {
  id: "chatbot-setup",
  version: 2,
  title: "Configurar o Chatbot IA",
  description: "Ative o atendimento automático, personalize as mensagens e ajuste os horários.",
  category: "ai",
  route: ROUTE,
  steps: [
    {
      target: "chatbot-header",
      title: "Chatbot IA",
      body: "Na aba Chatbot da central WhatsApp você define como o assistente responde às mensagens recebidas no WhatsApp conectado. A IA é fornecida pelo sistema: não há chave nem provedor para configurar aqui.",
    },
    {
      target: "chatbot-settings-tab",
      mode: "waitForClick",
      title: "Abrir Configurações",
      body: "Clique em Configurações para ver os ajustes do atendimento. O selo Ativo mostra o ajuste da tela; ele não confirma que o WhatsApp está conectado.",
    },
    {
      target: "chatbot-enabled",
      title: "Ativar ou pausar",
      body: "Liga ou desliga as respostas automáticas. A mudança só vale depois de salvar. Deixe desligado enquanto ainda estiver ajustando o atendimento.",
      fallbackBody: "Na aba Configurações, escolha se o chatbot ficará ativo. Essa escolha só é gravada ao salvar.",
    },
    {
      target: "chatbot-personalization",
      title: "Nome e mensagens do bot",
      body: "Defina o nome do assistente e a mensagem de fallback, usada quando a IA não consegue responder. O campo Boas-vindas é salvo, mas não é enviado automaticamente no atendimento atual.",
      fallbackBody: "Na aba Configurações, ajuste o nome do assistente e a mensagem de fallback.",
    },
    {
      target: "chatbot-hours",
      title: "Horário de atendimento",
      body: "Escolha os dias e horários em que a IA responde. Fora desse período, o cliente recebe a mensagem de fora do horário configurada aqui.",
      fallbackBody: "Na aba Configurações, escolha os dias, início, fim e a mensagem de fora do horário.",
    },
    {
      target: "chatbot-save-settings",
      title: "Salvar configurações",
      body: "Depois de revisar tudo, clique em Salvar Configurações. O tour não salva por você.",
      fallbackBody: "O botão Salvar Configurações fica ao final da aba Configurações.",
    },
    {
      title: "Antes de deixar ativo",
      body: "Conecte o WhatsApp na aba Conexão, teste perguntas comuns na aba Testar e acompanhe as conversas reais na aba Conversas. Lá você também pode assumir um atendimento e pausar a IA naquele contato.",
    },
  ],
};

export const chatbotKnowledgeTour: TourDef = {
  id: "chatbot-knowledge",
  version: 2,
  title: "Treinar o Chatbot",
  description: "Ajuste o jeito de falar e cadastre perguntas frequentes.",
  category: "ai",
  route: ROUTE,
  steps: [
    {
      target: "chatbot-training-tab",
      mode: "waitForClick",
      title: "Aba Treinamento",
      body: "Clique em Treinamento para editar o que a IA deve saber e como deve se comportar.",
    },
    {
      target: "chatbot-prompt",
      title: "Orientação principal",
      body: "Este texto orienta a personalidade e o jeito de atender. Escreva como você explicaria para uma atendente nova. As regras de segurança do sistema continuam valendo mesmo que o texto diga outra coisa.",
      fallbackBody: "Abra a aba Treinamento para ver o campo de orientação principal da IA.",
    },
    {
      target: "chatbot-instructions",
      title: "Informações do seu salão",
      body: "Use este campo para regras específicas: endereço, formas de pagamento, políticas de atraso e serviços que exigem avaliação. Preços e horários livres a IA consulta no cadastro de serviços e na agenda.",
      fallbackBody: "Na aba Treinamento, há um campo para instruções adicionais do salão.",
    },
    {
      target: "chatbot-save-prompt",
      title: "Salvar as orientações",
      body: "Quando quiser guardar o texto, clique em Salvar Prompt. Esse botão também salva os demais ajustes do chatbot alterados na tela.",
      fallbackBody: "Na aba Treinamento, Salvar Prompt guarda as orientações e os demais ajustes alterados.",
    },
    {
      target: "chatbot-knowledge-form",
      title: "Perguntas frequentes",
      body: "Cadastre perguntas e respostas prontas, como localização, estacionamento e cuidados após o atendimento. A IA usa esses itens como referência ao responder.",
      fallbackBody: "Abra a aba Treinamento para adicionar perguntas e respostas frequentes.",
    },
    {
      target: "chatbot-knowledge-add",
      title: "Adicionar conhecimento",
      body: "Com categoria, pergunta e resposta preenchidas, clique em Adicionar ao Conhecimento. O item é gravado na hora. O tour não adiciona por você.",
      fallbackBody: "O botão Adicionar ao Conhecimento fica abaixo do formulário de pergunta e resposta.",
    },
    {
      target: "chatbot-knowledge-list",
      title: "Revisar o que já foi ensinado",
      body: "A lista mostra os conhecimentos cadastrados. Remova respostas antigas pela lixeira e cadastre de novo quando uma informação mudar.",
      fallbackBody: "Se ainda não houver itens, a lista ficará vazia até você cadastrar o primeiro conhecimento.",
    },
    {
      title: "Boa prática",
      body: "Mantenha respostas curtas e verdadeiras. A IA considera até 20 itens ativos da base, então priorize as dúvidas mais comuns.",
    },
  ],
};

export const chatbotTestTour: TourDef = {
  id: "chatbot-test",
  version: 2,
  title: "Testar o Chatbot",
  description: "Simule mensagens com a IA real sem falar com nenhum cliente.",
  category: "ai",
  route: ROUTE,
  steps: [
    {
      target: "chatbot-test-tab",
      mode: "waitForClick",
      title: "Aba Testar",
      body: "Clique em Testar para abrir a conversa de simulação.",
    },
    {
      target: "chatbot-test-panel",
      title: "IA real, sem enviar nada",
      body: "O teste usa a configuração salva e a mesma IA do atendimento, mas não envia WhatsApp, não grava conversa e não cria nem altera agendamentos. Ele funciona mesmo com o chatbot desligado ou fora do horário.",
      fallbackBody: "Abra a aba Testar para ver a conversa de simulação.",
    },
    {
      target: "chatbot-test-input",
      title: "Digite uma pergunta comum",
      body: "Teste perguntas que clientes fazem de verdade, como preço, horário, endereço e como agendar. Salve as configurações antes, porque o teste lê o que está salvo.",
      fallbackBody: "Na aba Testar, há um campo para digitar a mensagem de exemplo.",
    },
    {
      target: "chatbot-test-send",
      title: "Enviar teste",
      body: "Envie a mensagem e leia a resposta. Se algo estiver errado, ajuste o Treinamento, salve e teste de novo.",
      fallbackBody: "O botão de envio fica ao lado do campo de mensagem da aba Testar.",
    },
    {
      title: "Depois do teste",
      body: "Com o chatbot ativo e o WhatsApp conectado, acompanhe as primeiras conversas reais na aba Conversas.",
    },
  ],
};
