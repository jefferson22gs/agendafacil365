import type { CategoryId } from "../types";

/** Videoaula narrada (cerca de 1 min), gravada no ambiente de demonstração com dados fictícios. */
export interface TrainingVideo {
  /** Número da aula na trilha (01–28). Define a ordem e o nome do arquivo. */
  n: number;
  /** Arquivo em /public/training/videos sem extensão: `<slug>.mp4` e a capa `<slug>.webp`. */
  slug: string;
  title: string;
  summary: string;
  category: CategoryId;
  seconds: number;
  /** Tela mostrada na aula (botão "Abrir tela"). Sem rota = página pública, fora do painel. */
  route?: string;
  /** Tutorial escrito do mesmo assunto: o vídeo aparece no topo dele e o cartão leva ao passo a passo. */
  articleId?: string;
  keywords: string[];
}

// Os arquivos saem de scripts/training-videos.py (720p, ~2 MB cada), a partir dos originais em 1080p.
export const VIDEOS: TrainingVideo[] = [
  { n: 1, slug: "01-pagina-oficial", title: "Página oficial", summary: "O que o sistema oferece, o plano com preço único e como criar sua conta ou ver a demonstração.", category: "start", seconds: 59, keywords: ["site", "plano", "preço", "criar conta", "demonstração", "teste grátis"] },
  { n: 2, slug: "02-dashboard", title: "Dashboard", summary: "Indicadores do dia, Assistente Inteligente, notificações e Ações rápidas logo ao entrar.", category: "start", seconds: 61, route: "/admin", articleId: "dashboard-daily-summary", keywords: ["painel", "início", "resumo", "indicadores", "ações rápidas"] },
  { n: 3, slug: "03-agendamentos", title: "Agendamentos", summary: "Lista do dia, pedidos pendentes para confirmar ou recusar, Agenda Completa e horários vagos.", category: "agenda", seconds: 63, route: "/admin/appointments", articleId: "appointments-manage-day", keywords: ["agenda", "horário", "confirmar", "recusar", "pendente", "calendário"] },
  { n: 4, slug: "04-clientes", title: "Clientes", summary: "Cadastro, número de visitas, valor gasto, edição dos dados e observações de cada cliente.", category: "clients", seconds: 55, route: "/admin/clients", articleId: "clients-register-customer", keywords: ["cadastro", "contato", "visitas", "gasto", "observações"] },
  { n: 5, slug: "05-profissionais", title: "Profissionais", summary: "Cadastro da equipe, especialidade, comissão em porcentagem e desempenho de cada um.", category: "team", seconds: 56, route: "/admin/professionals", articleId: "professionals-register-team", keywords: ["equipe", "funcionário", "comissão", "especialidade"] },
  { n: 6, slug: "06-servicos", title: "Serviços", summary: "Monte o cardápio com preço e duração; é ele que aparece na hora de agendar.", category: "start", seconds: 57, route: "/admin/services", articleId: "services-register-first-service", keywords: ["serviço", "preço", "duração", "procedimento", "tabela"] },
  { n: 7, slug: "07-retornos-lembretes", title: "Retornos e lembretes", summary: "Previsão de retorno, clientes que não voltam há tempo e quando o lembrete do horário é enviado.", category: "clients", seconds: 62, route: "/admin/returns", articleId: "returns-setup", keywords: ["retorno", "lembrete", "recorrência", "voltar", "aviso"] },
  { n: 8, slug: "08-financeiro", title: "Financeiro", summary: "Faturamento do mês, total de agendamentos, ticket médio e comissões por profissional.", category: "finance", seconds: 58, route: "/admin/financial", articleId: "financial-understand-month", keywords: ["faturamento", "comissão", "ticket médio", "dinheiro", "caixa"] },
  { n: 9, slug: "09-analytics", title: "Analytics", summary: "Períodos, sugestões inteligentes, horários de pico e ranking de serviços e profissionais.", category: "finance", seconds: 56, route: "/admin/analytics", articleId: "analytics-read-reports", keywords: ["relatório", "gráfico", "desempenho", "ranking", "horário de pico"] },
  { n: 10, slug: "10-pacotes", title: "Pacotes", summary: "Crie combos de serviços com quantidade, desconto e validade, e confira o preço final.", category: "sales", seconds: 56, route: "/admin/packages", articleId: "packages-create-combo", keywords: ["pacote", "combo", "assinatura", "créditos", "desconto"] },
  { n: 11, slug: "11-cupons", title: "Cupons", summary: "Desconto em porcentagem ou valor fixo, compra mínima, limite de usos, validade e só novos clientes.", category: "sales", seconds: 56, route: "/admin/coupons", articleId: "coupons-create-discount", keywords: ["cupom", "desconto", "promoção", "código"] },
  { n: 12, slug: "12-produtos", title: "Produtos", summary: "Cadastre produtos com preço, estoque, categoria e foto para vender junto do atendimento.", category: "sales", seconds: 56, route: "/admin/products", articleId: "products-build-catalog", keywords: ["produto", "estoque", "vitrine", "venda", "catálogo"] },
  { n: 13, slug: "13-multi-unidades", title: "Multi-Unidades", summary: "Crie um grupo de unidades e compare faturamento, agendamentos e clientes de cada uma.", category: "advanced", seconds: 55, route: "/admin/multi-units", articleId: "multi-units-group-summary", keywords: ["unidades", "filial", "franquia", "grupo", "rede"] },
  { n: 14, slug: "14-recursos-avancados", title: "Recursos avançados", summary: "BI e previsões, fidelidade, fila de espera, indicações, lookbook e metas do estabelecimento.", category: "advanced", seconds: 61, route: "/admin/advanced", articleId: "advanced-overview", keywords: ["metas", "fidelidade", "fila de espera", "indicações", "previsão", "lookbook"] },
  { n: 15, slug: "15-whatsapp-visao-geral", title: "WhatsApp: visão geral", summary: "As abas do WhatsApp em um só lugar: conversas, disparador, status, chatbot, contatos e conexão.", category: "whatsapp", seconds: 55, route: "/admin/whatsapp", keywords: ["zap", "abas", "central", "visão geral"] },
  { n: 16, slug: "16-whatsapp-conversas", title: "WhatsApp: conversas", summary: "Atenda pelo painel, veja se a conversa está com a IA ou com uma pessoa e filtre os atendimentos.", category: "whatsapp", seconds: 57, route: "/admin/whatsapp?aba=conversas", articleId: "whatsapp-inbox-attend", keywords: ["conversa", "atender", "responder", "mensagem", "inbox"] },
  { n: 17, slug: "17-whatsapp-disparador", title: "WhatsApp: disparador", summary: "Escolha quem recebe, escreva a mensagem, revise o envio e acompanhe o histórico.", category: "marketing", seconds: 57, route: "/admin/whatsapp?aba=disparador", articleId: "broadcast-send-responsibly", keywords: ["disparo", "mensagem em massa", "campanha", "envio"] },
  { n: 18, slug: "18-whatsapp-status", title: "WhatsApp: agendador de Status", summary: "Programe imagem, vídeo ou texto no Status com data, hora e recorrência, e veja no calendário.", category: "whatsapp", seconds: 56, route: "/admin/whatsapp?aba=status", articleId: "status-scheduler-create-post", keywords: ["status", "story", "post", "agendar", "calendário"] },
  { n: 19, slug: "19-whatsapp-chatbot-ia", title: "WhatsApp: chatbot com IA", summary: "Horário de funcionamento do robô, mensagem fora do horário e base de conhecimento com perguntas e respostas.", category: "ai", seconds: 62, route: "/admin/whatsapp?aba=chatbot", articleId: "chatbot-configure-first-time", keywords: ["chatbot", "robô", "ia", "assistente", "base de conhecimento"] },
  { n: 20, slug: "20-whatsapp-fluxo-agendamento", title: "WhatsApp: fluxo de agendamento", summary: "Deixe o cliente agendar pela conversa, com pedido pendente até você confirmar, e ajuste os lembretes.", category: "whatsapp", seconds: 62, route: "/admin/whatsapp?aba=fluxo", articleId: "guided-flow-client-journey", keywords: ["fluxo", "agendar pelo whatsapp", "botões", "lembrete", "confirmar"] },
  { n: 21, slug: "21-whatsapp-contatos", title: "WhatsApp: contatos", summary: "Importe contatos por arquivo VCF ou CSV, do celular ou do WhatsApp, e exporte seus clientes.", category: "clients", seconds: 57, route: "/admin/whatsapp?aba=contatos", articleId: "import-contacts-vcf-file", keywords: ["importar", "exportar", "vcf", "csv", "contatos"] },
  { n: 22, slug: "22-whatsapp-conexao", title: "WhatsApp: conexão", summary: "Conecte o número do estabelecimento, escolha as mensagens automáticas e ative os relatórios.", category: "whatsapp", seconds: 58, route: "/admin/whatsapp?aba=conexao", articleId: "whatsapp-connect-number", keywords: ["conectar", "qr code", "mensagens automáticas", "relatórios", "número"] },
  { n: 23, slug: "23-marketing", title: "Marketing", summary: "Monte campanhas de promoção, aviso ou cupom, personalize com o nome e escolha quem recebe.", category: "marketing", seconds: 56, route: "/admin/marketing", articleId: "marketing-compose-send", keywords: ["campanha", "promoção", "notificação", "push", "cupom"] },
  { n: 24, slug: "24-avaliacoes", title: "Avaliações", summary: "Média geral, nota em estrelas, comentários e como responder cada cliente.", category: "marketing", seconds: 56, route: "/admin/reviews", articleId: "reviews-read-reply", keywords: ["avaliação", "estrelas", "nota", "comentário", "responder"] },
  { n: 25, slug: "25-galeria", title: "Galeria", summary: "Registre o antes e depois com cliente, fotos e descrição do serviço realizado.", category: "marketing", seconds: 56, route: "/admin/gallery", articleId: "gallery-add-transformation", keywords: ["galeria", "antes e depois", "fotos", "transformação"] },
  { n: 26, slug: "26-configuracoes", title: "Configurações", summary: "Dados e endereço, horário de funcionamento, cor e logo, e o link público de agendamento.", category: "settings", seconds: 60, route: "/admin/settings", articleId: "settings-complete-salon-info", keywords: ["configurar", "horário", "logo", "cor", "link público", "endereço"] },
  { n: 27, slug: "27-minha-assinatura", title: "Minha assinatura", summary: "Plano, próxima cobrança, formas de pagamento, atualizar o status e cancelar.", category: "settings", seconds: 57, route: "/admin/subscription", articleId: "subscription-understand-and-manage", keywords: ["assinatura", "plano", "cobrança", "pagamento", "cancelar"] },
  { n: 28, slug: "28-contrato-central-treinamento", title: "Contrato e Central de Treinamento", summary: "O contrato assinado digitalmente, os termos de proteção de dados e como usar esta Central.", category: "settings", seconds: 62, route: "/admin/contract", articleId: "contract-sign", keywords: ["contrato", "assinatura digital", "lgpd", "treinamento", "primeiros passos"] },
];

export const videoSrc = (v: TrainingVideo) => `/training/videos/${v.slug}.mp4`;
export const videoPoster = (v: TrainingVideo) => `/training/videos/${v.slug}.webp`;
export const videoForArticle = (articleId: string) => VIDEOS.find((v) => v.articleId === articleId);
/** "0:59" */
export const videoTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
