import type { Article } from "../../types";

export const returnsArticles: Article[] = [
  {
    id: "returns-setup", version: 1, title: "Como configurar lembretes de retorno de procedimentos",
    summary: "Defina prazos de retorno por serviço e acompanhe os lembretes automáticos por WhatsApp, e-mail e app.",
    category: "clients", difficulty: "fácil", minutes: 4, route: "/admin/returns", tourId: "returns",
    steps: [
      { text: "Abra Serviços, edite o serviço e escolha o retorno padrão: 7, 15, 30, 60, 90, 120, 180 dias ou personalizado. Ligue os canais (WhatsApp, e-mail, app) e, se quiser, escreva a mensagem usando {cliente}, {procedimento}, {salao}, {dias}, {data_procedimento} e {link_agendamento}." },
      { text: "Ao criar ou concluir um agendamento, o prazo do serviço vem preenchido. Ajuste para aquele cliente se precisar; a tela mostra a data exata do alerta." },
      { text: "Na data, a partir das 09h, o sistema envia o lembrete pelos canais ativos e avisa você. Se o cliente já tiver reagendado o mesmo procedimento, o lembrete é cancelado sozinho (status Convertido)." },
      { text: "Em Retornos & Lembretes, acompanhe os indicadores e use Disparar agora, Chamar no WhatsApp ou Agendar retorno." },
    ],
    notes: [
      "Os prazos são uma ferramenta organizacional; a decisão clínica/estética de repetir o procedimento é do profissional.",
      "WhatsApp exige o número conectado; e-mail exige o e-mail do cliente no cadastro; app exige que o cliente tenha ativado as notificações. Clientes que pediram para não receber mensagens não são lembrados.",
    ],
    keywords: ["retorno", "retoque", "manutenção", "recorrência", "lembrete", "botox", "limpeza", "cron"],
  },
];
