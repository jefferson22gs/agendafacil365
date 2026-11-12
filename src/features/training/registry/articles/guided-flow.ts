import type { Article } from "../../types";

export const guidedFlowArticle: Article = {
  id: "guided-flow-client-journey", version: 3,
  title: "Como o cliente agenda, consulta o histórico e avalia pelo WhatsApp",
  summary: "Entenda o fluxo guiado, a área do cliente, as avaliações e a cobrança opcional.",
  category: "whatsapp", difficulty: "fácil", minutes: 4,
  route: "/admin/whatsapp?aba=fluxo", tourId: "guided-flow",
  steps: [
    { text: "Em WhatsApp > Fluxo de agendamento, ative o fluxo e salve. Use o simulador para experimentar sem criar reservas reais." },
    { text: "O cliente escolhe serviço, profissional, data e horário; confere o resumo antes de confirmar. Digitar V volta uma etapa e 0 abre o menu. As opções clicáveis dependem do modo escolhido." },
    { text: "Antes de confirmar, o cliente informa o e-mail (uma vez só; quem não tem segue sem). No link do salão o e-mail é obrigatório. E-mail e telefone identificam o cliente no cadastro. O cliente recebe e-mails com o logo e o nome do seu salão: agendamento confirmado, lembrete 24 horas antes, remarcação, cancelamento, recibo de pagamento, pacote liberado, créditos acabando ou perto de vencer, pedido de avaliação, aniversário e lembrete de retorno. Avaliação, créditos e aniversário não vão para quem pediu para não receber mensagens." },
    { text: "Meus agendamentos permite consultar, remarcar ou cancelar conforme o prazo permitido. O link pessoal abre o app do salão com próximos horários e histórico; não compartilhe esse link com outras pessoas." },
    { text: "Após concluir o atendimento, ative Pedir avaliação nas automações do WhatsApp para enviar o convite assim que você marca Concluído. A nota vai de 1 a 5, com comentário opcional. No histórico, o botão Avaliar fica disponível para atendimentos concluídos sem nota nos últimos 30 dias." },
    { text: "Na página de agendamento, as estrelas do profissional abrem comentários e respostas em uma janela com rolagem, sem selecionar o profissional. Sem avaliações, aparece Novo por aqui." },
    { text: "Para oferecer pagamento, abra Configurações > Cobrança, conecte sua conta e escolha os meios. Desligado, o bot não oferece pagamento. Pix manual exige conferência; os provedores dependem da confirmação do pagamento pela API." },
  ],
  notes: ["Na API oficial, a Meta limita o envio de mensagens livres à janela de atendimento. Fora dela, avisos exigem modelos aprovados.", "O simulador não prova entrega de mensagens nem liquidação de pagamentos. Teste a conexão com uma conversa autorizada."],
  keywords: ["histórico", "meus agendamentos", "avaliação", "estrelas", "profissional", "menu", "voltar", "botões", "cobrança", "simulador", "e-mail", "email", "confirmação", "pacotes", "lembrete", "recibo", "aniversário"],
};
