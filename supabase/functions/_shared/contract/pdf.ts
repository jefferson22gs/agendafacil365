// PDF A4 mínimo e válido sem dependências (fontes padrão Helvetica, codificação WinAnsi para acentos do português).
// ponytail: só texto com quebra automática; adicionar biblioteca (pdf-lib) se o contrato precisar de imagens/tabelas.
const W = 595.28, H = 841.89, M = 56, SIZE = 10, LEAD = 14.2;

// Larguras Helvetica (1/1000 em) dos ASCII imprimíveis; acentuados usam a largura da letra base.
const WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const MAP: Record<string, number> = { "–": 0x96, "—": 0x97, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "•": 0x95, "…": 0x85, "€": 0x80, "º": 0xba, "ª": 0xaa, "§": 0xa7, "°": 0xb0 };
function winAnsi(ch: string): number {
  if (MAP[ch]) return MAP[ch];
  const c = ch.codePointAt(0)!;
  return c >= 0x20 && c <= 0xff ? c : 0x3f; // fora do WinAnsi: "?"
}
function width(text: string, bold: boolean) {
  const t = bold ? BOLD : WIDTHS;
  let w = 0;
  for (const ch of text) { const base = ch.normalize("NFD")[0]; const c = base.charCodeAt(0); w += c >= 32 && c <= 126 ? t[c - 32] : 556; }
  return (w * SIZE) / 1000;
}
const escapeByte = (b: number) => b === 0x28 || b === 0x29 || b === 0x5c ? "\\" + String.fromCharCode(b) : b < 0x20 || b > 0x7e ? "\\" + b.toString(8).padStart(3, "0") : String.fromCharCode(b);
const pdfString = (s: string) => "(" + [...s].map((ch) => escapeByte(winAnsi(ch))).join("") + ")";

function wrap(text: string, bold: boolean, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (width(next, bold) <= max) { line = next; continue; }
    if (line) out.push(line);
    line = word;
    while (width(line, bold) > max) { let i = line.length; while (i > 1 && width(line.slice(0, i), bold) > max) i--; out.push(line.slice(0, i)); line = line.slice(i); }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** Títulos (CLÁUSULA, ANEXO, cabeçalho) em negrito. */
const isHeading = (p: string, i: number) => i < 2 || /^(CLÁUSULA|ANEXO|CONTRATADA \(|CONTRATANTE \(|CERTIFICAÇÃO)/.test(p);

export function contractPdf(text: string, footer: string): Uint8Array {
  const pages: string[][] = [[]];
  let y = H - M;
  const newPage = () => { pages.push([]); y = H - M; };
  text.split("\n").forEach((para, i) => {
    const bold = isHeading(para, i);
    if (bold && i > 1) y -= LEAD * 0.4;
    for (const l of wrap(para, bold, W - 2 * M)) {
      if (y < M + LEAD * 2) newPage();
      pages[pages.length - 1].push(`BT /${bold ? "F2" : "F1"} ${SIZE} Tf ${M} ${y.toFixed(2)} Td ${pdfString(l)} Tj ET`);
      y -= LEAD;
    }
    y -= LEAD * 0.35;
  });
  const objs: string[] = [];
  const add = (s: string) => objs.push(s) - 1 + 1; // número do objeto (1-based)
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // Pages, preenchido depois
  const font = (name: string) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
  const f1 = font("Helvetica"), f2 = font("Helvetica-Bold");
  const kids: number[] = [];
  pages.forEach((ops, n) => {
    const foot = `BT /F1 8 Tf ${M} 30 Td ${pdfString(`${footer} — página ${n + 1} de ${pages.length}`)} Tj ET`;
    const stream = [...ops, foot].join("\n");
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  // Conteúdo é ASCII puro (bytes >0x7E escapados em octal): offsets em caracteres = bytes.
  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff);
}
