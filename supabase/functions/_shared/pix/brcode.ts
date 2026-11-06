/** Gerador PIX BRCode estático (EMV QRCPM, Manual BR Code BCB) puro, sem dependências. */

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF). Vetor: "123456789" => 29B1. */
export function crc16ccitt(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emvTag(id: string, value: string): string {
  if (!/^\d{2}$/.test(id) || value.length < 1 || value.length > 99) throw new Error("brcode_invalid_tag");
  return id + String(value.length).padStart(2, "0") + value;
}

/** Remove acentos/caracteres fora do ASCII imprimível exigido pelo BR Code. */
function plain(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .\-]/g, "").trim().toUpperCase();
}

/** Chave DICT: e-mail, +telefone E.164, CPF (11), CNPJ (14) ou aleatória (EVP). */
export function validPixKey(key: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(key) && key.length <= 77 ||
    /^\+[1-9]\d{6,14}$/.test(key) || /^\d{11}$/.test(key) || /^\d{14}$/.test(key) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
}

export interface PixPayload {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
}

export function pixBRCode(payload: PixPayload): string {
  const key = String(payload.key ?? "").trim();
  const name = plain(String(payload.name ?? "")).slice(0, 25);
  const city = plain(String(payload.city ?? "")).slice(0, 15);
  const { amount, txid } = payload;
  if (!validPixKey(key)) throw new Error("pix_key_invalid");
  if (!name) throw new Error("pix_name_invalid");
  if (!city) throw new Error("pix_city_invalid");
  if (amount !== undefined && !(Number.isFinite(amount) && amount >= 0.01 && amount <= 9999999.99)) throw new Error("pix_amount_invalid");
  if (txid !== undefined && !/^[A-Za-z0-9]{1,25}$/.test(txid)) throw new Error("pix_txid_invalid");

  const body = emvTag("00", "01") +
    emvTag("26", emvTag("00", "BR.GOV.BCB.PIX") + emvTag("01", key)) +
    emvTag("52", "0000") +
    emvTag("53", "986") +
    (amount !== undefined ? emvTag("54", amount.toFixed(2)) : "") +
    emvTag("58", "BR") +
    emvTag("59", name) +
    emvTag("60", city) +
    emvTag("62", emvTag("05", txid ?? "***")) +
    "6304";
  return body + crc16ccitt(body);
}
