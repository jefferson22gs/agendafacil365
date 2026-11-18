// Ícones de serviço por segmento (salão, barbearia, unhas, estética, sobrancelha/cílios, bem-estar, saúde, pets...).
// Só emojis até Unicode 12 (renderizam em celulares antigos; 13+ viram caixa vazia). Emoji: aparece igual no link público, no WhatsApp e no e-mail, sem imagem extra. O nome é o rótulo acessível.
export interface IconGroup { id: string; label: string; icons: [emoji: string, name: string][] }

export const SERVICE_ICON_GROUPS: IconGroup[] = [
  { id: "cabelo", label: "Cabelo", icons: [["✂️", "Tesoura"], ["💇", "Corte de cabelo"], ["💇‍♂️", "Corte masculino"], ["💇‍♀️", "Corte feminino"], ["🎨", "Coloração"], ["💁‍♀️", "Escova"], ["🌀", "Cacheado"], ["🧴", "Hidratação"], ["👰", "Penteado de noiva"], ["👦", "Corte infantil"], ["💨", "Secador"]] },
  { id: "barbearia", label: "Barbearia", icons: [["💈", "Barbearia"], ["🧔", "Barba"], ["🪒", "Navalha"], ["🧔‍♂️", "Barba e bigode"], ["🧑‍🦲", "Careca/máquina"], ["📐", "Desenho/pezinho"], ["🔥", "Toalha quente"]] },
  { id: "unhas", label: "Unhas", icons: [["💅", "Manicure"], ["🦶", "Pedicure"], ["✨", "Unha em gel"], ["💎", "Alongamento de unhas"], ["🌸", "Nail art"], ["🖌️", "Esmaltação"]] },
  { id: "sobrancelha", label: "Sobrancelhas e cílios", icons: [["👁️", "Olhos"], ["🤨", "Design de sobrancelha"], ["👀", "Extensão de cílios"], ["🖊️", "Micropigmentação"], ["🌙", "Lash lifting"]] },
  { id: "estetica", label: "Estética", icons: [["🧖‍♀️", "Limpeza de pele"], ["🧖", "Tratamento facial"], ["💉", "Aplicação/injetável"], ["🧪", "Peeling"], ["🍑", "Estética corporal"], ["📏", "Redução de medidas"], ["⚡", "Radiofrequência"], ["🔦", "Laser"], ["🪒", "Depilação"], ["🍯", "Depilação com cera"], ["☀️", "Bronzeamento"], ["💋", "Lábios"]] },
  { id: "maquiagem", label: "Maquiagem", icons: [["💄", "Maquiagem"], ["👄", "Batom"], ["🌺", "Maquiagem de festa"], ["🎭", "Maquiagem artística"]] },
  { id: "bemestar", label: "Massagem e bem-estar", icons: [["💆", "Massagem"], ["💆‍♂️", "Massagem masculina"], ["♨️", "Pedras quentes"], ["🌿", "Aromaterapia"], ["🧘", "Relaxamento"], ["🛁", "Spa/banho"], ["🕯️", "Terapia holística"], ["🦵", "Drenagem linfática"]] },
  { id: "saude", label: "Saúde", icons: [["🩺", "Consulta"], ["🦷", "Odontologia"], ["🦴", "Fisioterapia"], ["🥗", "Nutrição"], ["🧠", "Psicologia"], ["👣", "Podologia"], ["💪", "Personal/treino"], ["🩹", "Curativo"]] },
  { id: "corpo", label: "Tatuagem e piercing", icons: [["🖋️", "Tatuagem"], ["💍", "Piercing"], ["🎯", "Retoque"]] },
  { id: "pet", label: "Pet", icons: [["🐶", "Banho e tosa (cão)"], ["🐱", "Banho e tosa (gato)"], ["🛁", "Banho pet"], ["🐾", "Pet"]] },
  { id: "geral", label: "Outros", icons: [["⭐", "Destaque"], ["🎁", "Pacote/presente"], ["📅", "Agendamento"], ["⏱️", "Rápido"], ["❤️", "Favorito"], ["🌟", "Premium"], ["🔁", "Manutenção/retorno"], ["🏷️", "Promoção"]] },
];

/** Todos os ícones sem repetição (o mesmo emoji pode estar em dois grupos). */
export const ALL_SERVICE_ICONS = [...new Map(SERVICE_ICON_GROUPS.flatMap(g => g.icons).map(i => [i[0], i])).values()];
export const iconName = (emoji: string) => ALL_SERVICE_ICONS.find(i => i[0] === emoji)?.[1] ?? emoji;
