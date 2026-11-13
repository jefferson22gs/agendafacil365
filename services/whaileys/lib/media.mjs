// Download de mídia por URL com proteção contra SSRF: só https, só origens configuradas, sem redirecionamento,
// tamanho limitado. A whaileys recebe o arquivo em memória (Buffer), nunca a URL crua.

export async function fetchMedia(url, { origins, maxBytes, fetchImpl = fetch, timeoutMs = 30_000 }) {
  let u;
  try { u = new URL(url); } catch { throw Object.assign(new Error("media_url_invalid"), { status: 400 }); }
  if (u.protocol !== "https:" || u.username || u.password || !origins.includes(u.origin)) {
    throw Object.assign(new Error("media_origin_not_allowed"), { status: 400 });
  }
  const res = await fetchImpl(u.href, { redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error("media_download_failed"), { status: 502 });
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > maxBytes) throw Object.assign(new Error("media_too_large"), { status: 413 });
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw Object.assign(new Error("media_too_large"), { status: 413 }); }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks), mimetype: res.headers.get("content-type") || undefined };
}

/** Troca `{ url }` da mensagem pelo arquivo baixado com segurança. */
export async function inlineMedia(content, url, opts) {
  if (!url) return content;
  const { buffer, mimetype } = await fetchMedia(url, opts);
  const out = { ...content };
  for (const k of ["image", "video", "document", "audio"]) {
    if (out[k]?.url) { out[k] = buffer; if (!out.mimetype && mimetype && k !== "image") out.mimetype = mimetype; }
  }
  return out;
}
