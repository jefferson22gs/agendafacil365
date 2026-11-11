import type { TourDef } from "../../types";

export const returnsTour: TourDef = {
  id: "returns", version: 1, title: "Retornos & Lembretes",
  description: "Acompanhe clientes no prazo de retorno do procedimento e dispare lembretes.",
  category: "clients", route: "/admin/returns",
  steps: [
    { title: "Como o retorno funciona", body: "Em Serviços, defina o retorno padrão (ex.: 30 dias para corte, 90 dias para Botox). Ao concluir o atendimento, a data do lembrete é calculada sozinha e pode ser ajustada para cada cliente." },
    { target: "sidebar-returns", title: "Onde fica", body: "Este painel mostra quem vence hoje, nos próximos 7 dias, os atrasados, os já notificados e os convertidos (que reagendaram)." },
    { title: "Envio automático", body: "Todos os dias a partir das 09h (fuso do salão) o lembrete vai para WhatsApp, e-mail e app do cliente, conforme os canais ativos no serviço. Você também recebe um aviso interno. Na fila não significa entregue: acompanhe o estado de cada canal no cartão." },
    { title: "Ações rápidas", body: "Disparar agora envia o lembrete na hora. Chamar no WhatsApp abre a conversa com a mensagem pronta. Agendar retorno abre o novo agendamento já preenchido." },
  ],
};
