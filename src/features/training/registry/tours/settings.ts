import type { TourDef } from "../../types";

export const settingsInfoTour: TourDef = {
  id: "settings-info",
  version: 1,
  title: "Dados do estabelecimento",
  description: "Preencha nome, endereço e formas de contato do estabelecimento.",
  category: "settings",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-header",
      title: "Configure seu estabelecimento",
      body: "Aqui você cria ou atualiza os dados do estabelecimento. As alterações dos campos só ficam gravadas quando você clica em Salvar.",
    },
    {
      target: "settings-name",
      title: "Nome do estabelecimento",
      body: "Informe o nome que seus clientes conhecem. Este campo é obrigatório para salvar o cadastro.",
    },
    {
      target: "settings-slug",
      title: "Endereço do link público",
      body: "Este campo define a parte final do link, depois de /s/. Use um nome curto, como meu-salao; o sistema ajusta espaços e acentos.",
      tip: "Depois de divulgar seu link, evite trocar este nome: o endereço divulgado deixará de apontar para o salão.",
    },
    {
      target: "settings-description",
      title: "Apresente seu salão",
      body: "Escreva uma descrição curta para a página pública. Logo abaixo, você também pode preencher Razão Social e CNPJ.",
    },
    {
      target: "settings-contact",
      title: "Telefone e WhatsApp",
      body: "Preencha os contatos do estabelecimento para facilitar o atendimento. Informar um número de WhatsApp aqui não conecta o envio automático de mensagens.",
    },
    {
      target: "settings-email",
      title: "E-mail de contato",
      body: "Informe o e-mail usado pelo salão. Este campo é separado do e-mail da sua conta de acesso.",
    },
    {
      target: "settings-address",
      title: "Onde fica o salão",
      body: "Preencha rua, número, bairro, cidade, estado e CEP. Confira os dados para que o cliente saiba onde será atendido.",
    },
    {
      target: "settings-save",
      title: "Grave as alterações",
      body: "Quando terminar, clique em Salvar e aguarde a confirmação. No primeiro cadastro, esse botão cria o salão; nos seguintes, atualiza os dados.",
    },
    {
      title: "Próximo passo",
      body: "Agora defina os dias e horários de funcionamento. Depois, cadastre os serviços e profissionais que atendem no salão.",
    },
  ],
};

export const settingsHoursTour: TourDef = {
  id: "settings-hours",
  version: 1,
  title: "Horários de funcionamento",
  description: "Defina os dias de atendimento e a pausa para almoço.",
  category: "settings",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-hours",
      title: "A semana do salão",
      body: "Esta área reúne os dias e horários de funcionamento. Ela também permite configurar a pausa para almoço.",
    },
    {
      target: "settings-hours-days",
      title: "Aberto ou fechado",
      body: "Ative cada dia em que o salão atende e preencha os horários de início e fim. Os dias desligados aparecem como Fechado.",
      tip: "Revise todos os dias antes de salvar. Em um salão novo, os dias desta lista podem começar fechados.",
    },
    {
      target: "settings-hours-copy-monday",
      title: "Repetir a segunda-feira",
      body: "Se quiser, configure a segunda-feira e clique em Copiar de Segunda para Todos. Isso copia os horários e a situação aberto ou fechado para os outros seis dias, incluindo sábado e domingo.",
    },
    {
      target: "settings-hours-lunch",
      title: "Pausa para almoço",
      body: "Ative a pausa se o salão não atende durante o almoço. Quando ligada, aparecem os horários de início e fim e os dias em que ela deve ser aplicada.",
    },
    {
      target: "settings-save",
      title: "Salvar os horários",
      body: "Quando terminar a revisão, clique em Salvar no topo da página. As mudanças também gravam os outros dados que você alterou nesta tela.",
    },
    {
      title: "Próximo passo",
      body: "Com os horários definidos, confira serviços e profissionais. Depois abra o link público e verifique o que seus clientes veem.",
    },
  ],
};

export const settingsPublicLinkTour: TourDef = {
  id: "settings-public-link",
  version: 1,
  title: "Link público de agendamento",
  description: "Encontre seu link, confira o agendamento online e copie ou abra a página.",
  category: "start",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-header",
      title: "Sua página de agendamento",
      body: "Nesta tela você define o endereço da página que será compartilhada com os clientes. Eles usam esse link para acessar o agendamento público do salão.",
    },
    {
      target: "settings-slug",
      title: "Defina o endereço",
      body: "Preencha o campo Slug do Link Público e salve o salão. O cartão com o link aparece somente depois que o salão está salvo e esse campo está preenchido.",
    },
    {
      target: "settings-public-booking-toggle",
      title: "Agendamento online",
      body: "Confira a opção Agendamento Online Ativo. Se alterar a opção, clique em Salvar no topo para gravar a mudança.",
      fallbackBody: "Primeiro preencha o endereço do link e salve o salão. Depois aparecerá a opção Agendamento Online Ativo no cartão do link público.",
    },
    {
      target: "settings-public-link-copy",
      title: "Copiar o link",
      body: "Quando quiser compartilhar, clique no botão com o símbolo de cópia. Após a confirmação Link copiado, cole o endereço na conversa com o cliente ou no perfil do salão.",
      fallbackBody: "Depois de salvar o salão com um endereço de link, aparece o botão Copiar link no cartão Link Público de Agendamento.",
    },
    {
      target: "settings-public-link-open",
      title: "Ver como o cliente",
      body: "Se quiser conferir a página, clique em Abrir em nova aba. Isso abre seu link público em outra aba; não cria um agendamento.",
      tip: "Se nada abrir, confira se o navegador bloqueou a nova aba.",
      fallbackBody: "O botão Abrir em nova aba fica ao lado de Copiar link depois de salvar o salão com um endereço de link.",
    },
    {
      title: "Próximo passo",
      body: "Confira a página pública antes de divulgar. Verifique nome, horários, serviços e profissionais; só finalize um agendamento se realmente quiser criá-lo.",
    },
  ],
};

export const settingsBrandingTour: TourDef = {
  id: "settings-branding",
  version: 1,
  title: "Personalização do salão",
  description: "Escolha a cor e conheça as opções para colocar o logo do salão.",
  category: "settings",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-branding",
      title: "A aparência do salão",
      body: "Personalização reúne a cor principal e o logo. Você pode informar um endereço de imagem, escolher um arquivo ou usar a câmera.",
    },
    {
      target: "settings-branding-color",
      title: "Cor principal",
      body: "Escolha a cor pelo quadrado colorido ou preencha o código da cor no campo ao lado. Use uma cor que combine com a identidade do salão.",
    },
    {
      target: "settings-branding-logo",
      title: "Seu logo",
      body: "Na aba Link URL, informe o endereço completo de uma imagem. A prévia aparece quando há um endereço preenchido e a imagem carrega.",
    },
    {
      target: "settings-logo-upload-tab",
      title: "Enviar uma imagem",
      body: "Se preferir, abra Upload e escolha uma imagem de até 2 MB. Salve o salão primeiro: a escolha do arquivo já envia a imagem, mas ainda é preciso Salvar para gravar o endereço do logo no salão.",
    },
    {
      target: "settings-logo-camera-tab",
      title: "Usar a câmera",
      body: "A aba Câmera oferece Abrir Câmera e pede permissão ao navegador. Capturar envia a foto; faça isso só quando quiser e depois clique em Salvar para gravar o logo.",
      tip: "O salão precisa estar salvo antes de enviar um arquivo ou capturar a foto do logo.",
    },
    {
      target: "settings-save",
      title: "Salvar a personalização",
      body: "Quando terminar, clique em Salvar para gravar cor e endereço do logo. O tour não escolhe arquivos nem liga a câmera por você.",
    },
    {
      title: "Próximo passo",
      body: "Abra o link público para conferir a apresentação do salão. Se necessário, volte aqui e ajuste a cor ou o logo.",
    },
  ],
};

export const settingsNotificationsTour: TourDef = {
  id: "settings-notifications",
  version: 1,
  title: "Notificações no navegador",
  description: "Entenda os alertas do navegador e as permissões necessárias.",
  category: "settings",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-notifications",
      title: "Alertas no navegador",
      body: "Esta seção controla as notificações neste navegador. Ela mostra se estão ativadas, desativadas, bloqueadas ou não são suportadas.",
    },
    {
      target: "settings-notifications",
      title: "Permissão e teste",
      body: "Se quiser receber alertas, use Ativar e autorize no navegador. Se as notificações estiverem bloqueadas, libere nas configurações do navegador; o botão Enviar notificação de teste desta seção mostra apenas um aviso na tela.",
      tip: "Ativar ou Desativar já altera a inscrição de notificações, sem usar o botão Salvar do salão.",
    },
    {
      title: "Próximo passo",
      body: "Confira os avisos recebidos no Dashboard. Ativar notificações aqui não conecta o WhatsApp do salão.",
    },
  ],
};

export const settingsPixTour: TourDef = {
  id: "settings-pix",
  version: 1,
  title: "Dados de PIX do salão",
  description: "Conheça o campo de PIX sem expor dados reais durante o treinamento.",
  category: "settings",
  route: "/admin/settings",
  steps: [
    {
      target: "settings-header",
      title: "PIX nas configurações",
      body: "A tela tem um campo Chave PIX em Informações Básicas. Ele guarda a informação de pagamento do salão; não é uma configuração de cobrança automática.",
    },
    {
      target: "settings-save",
      title: "Dados de pagamento exigem cuidado",
      body: "Confira os dados de PIX apenas quando for configurar o pagamento do salão e salve ao terminar. Não use nem compartilhe chaves reais em demonstrações ou capturas de treinamento.",
    },
    {
      title: "Próximo passo",
      body: "Depois de configurar, confira o fluxo de confirmação de agendamento. Cadastrar uma chave não confirma que um pagamento foi recebido.",
    },
  ],
};
