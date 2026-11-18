// Arquivo enviado ao armazenamento do sistema (upload/câmera): as telas não exibem o endereço interno.
// ponytail: o endereço continua na página pública (a imagem precisa carregar); esconder lá exigiria proxy de imagem.
export const isStoredFile = (url: string | null | undefined) => !!url && /\/storage\/v1\/object\/public\//.test(url);
