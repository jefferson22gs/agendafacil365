import { deflateSync } from 'node:zlib';
import { hexColor, textOnColor } from './_pwa.js';

// ponytail: initials only; add an image codec only when server-side logo resizing is required.
const GLYPHS: Record<string, string> = {
  A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1e11111111111e',
  E: '1f10101e10101f', F: '1f10101e101010', G: '0e11101711110f', H: '1111111f111111',
  I: '0e04040404040e', J: '0702020212120c', K: '11121418141211', L: '1010101010101f',
  M: '111b1515111111', N: '11191513111111', O: '0e11111111110e', P: '1e11111e101010',
  Q: '0e11111115120d', R: '1e11111e141211', S: '0f10100e01011e', T: '1f040404040404',
  U: '1111111111110e', V: '11111111110a04', W: '11111115151b11', X: '11110a040a1111',
  Y: '11110a04040404', Z: '1f01020408101f',
  '0': '0e11131519110e', '1': '040c040404040e', '2': '0e11010204081f', '3': '1e01010e01011e',
  '4': '02060a121f0202', '5': '1f10101e01011e', '6': '0e10101e11110e', '7': '1f010204080808',
  '8': '0e11110e11110e', '9': '0e11110f01010e', '?': '0e110102040004',
};
export function initials(name: string): string {
  // Só palavras que começam com letra/dígito: "Jefferson - Agendamento" vira "JA", não "J-".
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('') || '?';
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}
export function initialsPng(name: string, color: string, size: number): Uint8Array {
  if (![180, 192, 512].includes(size)) throw new RangeError('Unsupported icon size');
  const rgb = (value: string) => {
    let hex = hexColor(value).slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  };
  const bg = rgb(color), fg = rgb(textOnColor(color));
  const letters = Array.from(initials(name)), width = letters.length * 6 - 1;
  const scale = Math.max(1, Math.floor(size * 0.55 / Math.max(width, 7)));
  const left = Math.floor((size - width * scale) / 2), top = Math.floor((size - 7 * scale) / 2);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor((x - left) / scale), gy = Math.floor((y - top) / scale);
    const letter = letters[Math.floor(gx / 6)], col = gx % 6;
    const glyph = GLYPHS[letter] ?? GLYPHS['?'];
    const on = gx >= 0 && gx < width && gy >= 0 && gy < 7 && col < 5 && (parseInt(glyph.slice(gy * 2, gy * 2 + 2), 16) & (1 << (4 - col)));
    raw.set(on ? fg : bg, y * (size * 3 + 1) + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
