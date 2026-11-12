import type { Article } from "../../types";

export const packagesArticles: Article[] = [
  {
    id: "packages-create-combo",
    version: 1,
    title: "Como criar um pacote de serviços",
    summary: "Junte serviços em um combo, escolha quantidades e deixe o sistema calcular o preço com desconto.",
    category: "sales",
    difficulty: "fácil",
    minutes: 5,
    route: "/admin/packages",
    tourId: "packages",
    steps: [
      { text: "Cadastre os serviços que entrarão no pacote. A lista de escolha usa os serviços ativos do salão. Depois abra Pacotes e clique em Novo Pacote." },
      {
        text: "Dê um nome claro ao combo, como 5 Cortes + 5 Barbas. A descrição é opcional.",
        image: { src: "/training/packages/new-dialog.webp", alt: "Formulário de novo pacote", pending: true },
      },
      { text: "Escolha um serviço, informe a quantidade de sessões e clique no botão de mais. Repita para cada serviço que deseja incluir." },
      { text: "Revise a lista de serviços. Se adicionou algo errado, use o X para remover antes de salvar." },
      { text: "Informe o desconto em porcentagem, entre 0 e 50. O sistema calcula o preço final usando os preços atuais dos serviços." },
      { text: "Defina a validade em dias. O formulário exige pelo menos 30 dias." },
      {
        text: "Confira o resumo: preço original, desconto, total de sessões e preço final. Clique em Criar Pacote somente quando estiver correto.",
        image: { src: "/training/packages/price-summary.webp", alt: "Resumo de preço do pacote", pending: true },
      },
      {
        text: "O pacote aparece na lista e no link público. Use o lápis para editar ou a lixeira para excluir com confirmação.",
        image: { src: "/training/packages/list.webp", alt: "Lista de pacotes cadastrados", pending: true },
      },
    ],
    notes: [
      "A tela grava o preço calculado no momento da criação ou edição. Mudanças posteriores no preço dos serviços não recalculam automaticamente pacotes já salvos.",
      "Pacotes comprados pelo link geram créditos por cliente, com saldo de sessões e validade contada a partir do pagamento.",
    ],
    keywords: ["pacote", "combo", "serviços", "sessões", "quantidade", "desconto", "validade", "preço", "promoção", "editar", "excluir"],
  },
  {
    id: "packages-sell-and-use",
    version: 2,
    title: "Como o cliente assina um pacote e usa os créditos",
    summary: "Venda pelo link do salão, pagamento por Pix ou provedor, liberação dos créditos e uso ao agendar.",
    category: "sales",
    difficulty: "fácil",
    minutes: 4,
    route: "/admin/packages",
    tourId: "packages",
    steps: [
      { text: "No link do salão, aba Pacotes, o cliente toca no pacote. O sistema pergunta: quer agendar um horário hoje?" },
      { text: "Sim: o pacote entra no pedido e o cliente segue escolhendo serviço, profissional e horário normalmente." },
      { text: "Não, só assinar: o cliente informa nome e WhatsApp e vai direto para o pagamento. Com provedor conectado em Configurações > Cobrança, recebe o Pix copia e cola (Mercado Pago) ou a página segura de pagamento. Sem provedor, recebe o Pix pela chave do salão." },
      { text: "Com provedor, ao pagar os créditos são liberados sozinhos: você recebe o aviso Pacote vendido e o cliente recebe a confirmação no WhatsApp." },
      { text: "Com Pix pela chave do salão, confira o extrato e, em Pacotes > Pedidos de pacotes, clique em Confirmar pagamento. Isso libera os créditos e avisa o cliente." },
      { text: "Para usar: ao agendar, na etapa de confirmação, o cliente responde Sim em Você é assinante de algum pacote? e toca em Verificar meus créditos. Se o serviço escolhido estiver no pacote, ele sai por R$ 0,00 e 1 sessão é descontada." },
      { text: "Pelo WhatsApp (fluxo guiado): o menu mostra 🎁 Pacotes quando há pacote ativo. O cliente escolhe o pacote e responde se quer agendar hoje. Sim: escolhe o horário e recebe o pagamento do pacote; pago, aquele horário já usa 1 crédito. Não: recebe direto o Pix copia e cola ou o link de pagamento do provedor configurado." },
      { text: "Assinante que agenda pelo WhatsApp não precisa avisar: o robô reconhece o número, mostra o serviço como incluso no pacote e desconta 1 crédito sozinho." },
      { text: "Se o agendamento for cancelado, a sessão volta para o saldo do cliente." },
    ],
    notes: [
      "Os créditos ficam ligados ao WhatsApp informado na compra. Outro número não enxerga nem usa os créditos.",
      "O preço do pacote sempre vem do cadastro do salão, nunca do navegador do cliente.",
      "O crédito vale para o serviço principal do agendamento; serviços extras seguem com valor normal.",
    ],
    keywords: ["assinante", "assinatura", "pacote", "créditos", "sessões", "pix", "pagamento", "comprar", "vender", "saldo", "confirmar pagamento", "whatsapp", "robô"],
  },
];
