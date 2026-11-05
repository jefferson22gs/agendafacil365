import type { TourDef } from "../../types";

export const galleryTour: TourDef = {
  id: "gallery", version: 1, title: "Galeria Antes & Depois",
  description: "Adicione fotos reais com autorização e entenda a visibilidade.",
  category: "marketing", route: "/admin/gallery",
  steps: [
    { target: "gallery-header", title: "Transformações dos clientes", body: "A Galeria registra fotos de antes e depois ligadas a um cliente. Peça autorização antes de fotografar ou divulgar." },
    { target: "gallery-list", title: "Fotos registradas", body: "Cada cartão mostra as fotos, cliente, data e visibilidade. O olho muda entre pública e privada; a lixeira exclui o registro após confirmação.", fallbackBody: "Depois do primeiro cadastro, seus cartões aparecem aqui com fotos e ações. Excluir o registro não apaga automaticamente os arquivos enviados." },
    { target: "gallery-share", title: "Compartilhamento limitado", body: "O botão de compartilhar aparece quando existe um código de compartilhamento. A página pública de transformações ainda não existe nesta versão, por isso o botão só avisa e não copia um endereço.", fallbackBody: "Copiar link aparece só em registros com código de compartilhamento, criado ao escolher Compartilhável por link. Falta a página pública que abre esse endereço." },
    { target: "gallery-new-button", title: "Nova transformação", body: "Clique em Nova Transformação para abrir o formulário.", mode: "waitForClick" },
    { target: "gallery-client", title: "Escolha o cliente", body: "Selecione o cliente cadastrado. Adicione pelo menos uma foto, antes ou depois; a descrição é opcional.", fallbackBody: "No formulário, escolha um cliente. Se a lista estiver vazia, cadastre o cliente primeiro." },
    { target: "gallery-source-tabs", title: "Três formas de adicionar fotos", body: "Link permite informar o endereço da imagem; Upload escolhe um arquivo; Câmera usa a câmera do aparelho. Enviar arquivo ou capturar foto já grava o arquivo, antes de Adicionar a transformação.", fallbackBody: "O formulário tem as abas Link, Upload e Câmera. Cancelar o formulário não remove os arquivos já enviados." },
    { target: "gallery-upload-tab", title: "Conhecer Upload", body: "Clique em Upload para mostrar os campos Antes e Depois. Não escolha arquivo só para experimentar: o envio começa ao selecioná-lo.", mode: "waitForClick", fallbackBody: "Abra Nova Transformação para acessar Upload." },
    { target: "gallery-upload-fields", title: "Antes e depois separados", body: "Escolha a foto no campo correspondente e aguarde terminar o envio. O armazenamento de imagens precisa estar configurado para funcionar.", fallbackBody: "Upload mostra dois campos: Antes e Depois. A imagem é enviada assim que você escolhe o arquivo." },
    { target: "gallery-camera-tab", title: "Conhecer Câmera", body: "Clique em Câmera para ver as opções de captura. Trocar a aba não tira foto.", mode: "waitForClick", fallbackBody: "A aba Câmera fica ao lado de Upload no formulário." },
    { target: "gallery-camera-panel", title: "Capturar antes ou depois", body: "Capturar Antes ou Capturar Depois pede acesso à câmera. Capturar Foto tira e envia a imagem; use somente com autorização, e permita a câmera no navegador.", fallbackBody: "Câmera mostra opções Antes e Depois. Com a câmera aberta, Capturar Foto envia o arquivo e Cancelar encerra a câmera." },
    { target: "gallery-visibility", title: "Quem pode ver", body: "Privada mantém o registro fora da galeria pública; Pública permite aparecer na página do salão. Compartilhável por link gera um código, mas seu link ainda não abre uma página nesta versão.", fallbackBody: "Visibilidade fica abaixo da descrição: Privada, Pública ou Compartilhável por link." },
    { target: "gallery-save", title: "Salvar o registro", body: "Quando estiver pronto, clique em Adicionar para gravar a transformação. Não há campo para ligar o registro a um profissional nesta tela, então ele não aparece automaticamente no perfil de um profissional.", fallbackBody: "Adicionar grava o registro com cliente, fotos, descrição e visibilidade. O tour não salva por você." },
    { title: "Próximo passo", body: "Feche o formulário quando terminar e confira os cartões. Antes de divulgar, teste a galeria da página do salão e confirme a autorização do cliente." },
  ],
};
