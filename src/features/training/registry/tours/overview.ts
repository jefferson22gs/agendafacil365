import type { TourDef } from "../../types";

export const overviewTour: TourDef = {
  id: "overview", version: 2,
  title: "Conheça o Agenda Fácil 365",
  description: "Navegue pelo painel, pelo menu completo e pelos atalhos do celular.",
  category: "start", route: "/admin",
  steps: [
    { title: "Seu painel de trabalho", body: "Este passeio explica como encontrar as áreas do estabelecimento. Próximo avança, Voltar revisa e Fechar tour ou Esc interrompe. Nenhum cadastro, envio ou pagamento é feito pelo tour." },
    { target: "layout-bottom-nav", mobileOnly: true, title: "Atalhos no celular e tablet", body: "Início, Agenda, Clientes e WhatsApp abrem as telas mais usadas. Menu abre a navegação completa. A barra permanece disponível enquanto você rola a página." },
    { target: "layout-bottom-menu", mobileOnly: true, title: "Menu completo", body: "Use Menu aqui embaixo ou o botão de três linhas no cabeçalho. O painel lateral fecha ao escolher um destino, tocar fora, usar o botão Fechar menu ou pressionar Esc. No próximo passo vamos abri-lo para mostrar a busca." },
    { target: "layout-menu-search", title: "Encontre qualquer área", body: "Digite parte do nome, com ou sem acento, para filtrar os destinos. Por exemplo, agenda, financeiro ou contatos. Limpe o campo para recuperar todos os itens. A lista rola independentemente do cabeçalho e do botão Sair." },
    { target: "sidebar-appointments", title: "Operação diária", body: "Agendamentos abre a agenda. No mesmo grupo ficam Clientes, Profissionais e Serviços. O item da tela atual fica destacado. Escolher um destino apenas abre a tela; não cria registros." },
    { target: "sidebar-financial", title: "Gestão do estabelecimento", body: "Financeiro acompanha valores e comissões dos atendimentos. Neste grupo também estão Analytics, Pacotes, Cupons, Produtos, Multi-Unidades e Recursos Avançados. Use a ajuda de cada tela para conhecer seus critérios e limitações." },
    { target: "sidebar-whatsapp", title: "Uma entrada para WhatsApp", body: "WhatsApp fica em Relacionamento. A seta ao lado expande os atalhos, nesta ordem: Conversas, Disparador, Agendador de status, Chatbot IA, Contatos e Conexão. Cada atalho abre a aba correspondente da central. Marketing continua uma tela separada." },
    { target: "sidebar-settings", title: "Configurações e ajuda", body: "No final da lista ficam Configurações, Minha Assinatura e Central de Treinamento. Role o menu para alcançá-los, mesmo em celulares na horizontal. Configurações reúne os dados do estabelecimento e as opções disponíveis para personalizá-lo." },
    { title: "Mais espaço no computador", desktopOnly: true, body: "O botão no topo do menu alterna entre a navegação completa e somente ícones. Passe o mouse ou coloque o foco em um ícone para ler o nome. A preferência é salva neste navegador, quando o armazenamento está disponível. Expandir mostra novamente busca, grupos e abas do WhatsApp." },
    { target: "layout-help-button", title: "Ajuda em todas as telas", body: "Ajuda fica sempre no cabeçalho, inclusive no celular. Abra Fazer tour desta tela para aprender o que está vendo. Você também pode buscar um tutorial, continuar um tour interrompido ou abrir a Central de Treinamento." },
    { title: "Pronto para trabalhar", body: "Os controles de aparência e notificações ficam ao lado da Ajuda. Sem conexão, o menu mostra Modo offline; isso não garante que operações possam ser salvas. Na demonstração, a faixa superior identifica os dados fictícios e as integrações ficam desligadas." },
  ],
};
