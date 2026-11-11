import type { TourDef } from "../../types";

export const contractTour: TourDef = {
  id: "contract", version: 1, title: "Contrato e assinatura eletrônica",
  description: "Confirme os dados, revise o contrato preenchido e assine na Autentique.",
  category: "settings", route: "/admin/contract",
  steps: [
    { title: "Dados do contrato", body: "Os campos já vêm com o que o sistema sabe do seu estabelecimento. Confira CNPJ/CPF, endereço e o responsável legal; o CEP completa o endereço." },
    { title: "Revisar antes de assinar", body: "Revisar contrato preenchido mostra o texto exato que será assinado, com o hash SHA-256. Nada é enviado nesta etapa." },
    { title: "Assinatura das duas partes", body: "Ao gerar, o contrato vai para a Autentique e cada parte recebe o link por e-mail. O status muda sozinho quando cada um assina." },
  ],
};
