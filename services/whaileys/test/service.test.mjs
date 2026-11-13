// Contratos do serviço sem WhatsApp: conversão de payloads, autenticação, isolamento por instância,
// bloqueio de URLs (SSRF), fila durável do webhook, envelopes de eventos e pasta de Status.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import * as P from "../lib/payloads.mjs";
import { createHandler } from "../lib/http.mjs";
import { upsertEnvelope, updateEnvelope, realJid } from "../lib/events.mjs";
import { WebhookOutbox, History, instanceDirs } from "../lib/store.mjs";
import { fetchMedia } from "../lib/media.mjs";
import { StatusFolder, nextSlot } from "../lib/watcher.mjs";
import { Manager } from "../lib/manager.mjs";
import { loadConfig } from "../lib/config.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "whaileys-test-"));
const KEY = "k".repeat(32);

test("payloads: botões, lista, enquete, mídia e Status no contrato da Evolution", () => {
  const b = P.buttonsMessage({ number: "5511912345678", title: "Confirmar", description: "Confira", footer: "Studio", buttons: [{ type: "reply", displayText: "✅ Confirmar", id: "confirm_yes" }, { type: "reply", displayText: "❌ Cancelar", id: "ab12cd.2" }] });
  assert.equal(b.jid, "5511912345678@s.whatsapp.net");
  assert.deepEqual(b.content.buttons.map((x) => [x.buttonId, x.buttonText.displayText, x.type]), [["confirm_yes", "✅ Confirmar", 1], ["ab12cd.2", "❌ Cancelar", 1]]);
  assert.equal(b.content.text, "*Confirmar*\n\nConfira"); assert.equal(b.content.footer, "Studio");
  const img = P.buttonsMessage({ number: "5511912345678", description: "x", image: "https://a.supabase.co/i.png", buttons: [{ displayText: "A", id: "a_b" }] });
  assert.equal(img.content.headerType, 4); assert.equal(img.content.image.url, "https://a.supabase.co/i.png"); assert.equal(img.mediaUrl, "https://a.supabase.co/i.png");
  assert.throws(() => P.buttonsMessage({ number: "5511912345678", description: "x", buttons: [1, 2, 3, 4].map((i) => ({ displayText: `B${i}`, id: `b${i}` })) }), /buttons_count/);
  const l = P.listMessage({ number: "5511912345678", title: "Serviços", description: "Qual?", buttonText: "☰ Menu", footerText: "V volta", sections: [{ title: "S", rows: [{ title: "Corte", description: "R$ 45", rowId: "ab12cd.1" }] }] });
  assert.equal(l.content.buttonText, "☰ Menu"); assert.equal(l.content.sections[0].rows[0].rowId, "ab12cd.1"); assert.equal(l.content.footer, "V volta");
  assert.throws(() => P.listMessage({ number: "5511912345678", description: "x", sections: [{ rows: Array.from({ length: 11 }, (_, i) => ({ title: "t", rowId: `r${i}` })) }] }), /rows_count/);
  assert.equal(P.pollMessage({ number: "5511912345678", name: "Menu", values: ["1", "2"] }).content.poll.selectableCount, 1);
  const doc = P.mediaMessage({ number: "5511912345678", mediatype: "document", media: "https://a.supabase.co/x.pdf", fileName: "pix.pdf" });
  assert.equal(doc.content.fileName, "pix.pdf"); assert.equal(doc.content.mimetype, "application/octet-stream");
  const st = P.statusMessage({ type: "text", content: "Agenda aberta", statusJidList: ["5511911111111@s.whatsapp.net", "5511911111111", "5511922222222@s.whatsapp.net"] });
  assert.deepEqual(st.jids, ["5511911111111@s.whatsapp.net", "5511922222222@s.whatsapp.net"], "sem repetição");
  assert.equal(st.options.backgroundColor, "#2563EB");
  assert.throws(() => P.statusMessage({ type: "text", content: "x", allContacts: true }), /status_list_required/);
});

test("payloads: nunca grupo, canal, LID ou número inválido", () => {
  for (const n of ["120363000000000000", "123", "0011912345678", "5511912345678@g.us", "abc"]) assert.throws(() => P.jidOf(n), /number_invalid/, n);
  assert.throws(() => P.buttonsMessage({ number: "5511912345678", description: "x", buttons: [{ displayText: "A", id: "../x" }] }), /button_id_invalid/);
});

function harness(manager) {
  const server = http.createServer(createHandler(manager, { apiKey: KEY, maxBodyBytes: 2_000 }));
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

test("http: chave obrigatória, nome de instância validado, corpo limitado, rota da Evolution", async () => {
  const calls = [];
  const manager = new Proxy({}, { get: (_t, op) => (...args) => { calls.push([op, ...args]); return op === "send" ? { key: { id: "MSG1" } } : { ok: true }; } });
  const { server, url } = await harness(manager);
  try {
    const post = (p, body, key = KEY) => fetch(url + p, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await post("/message/sendText/inst_1", { number: "5511912345678", text: "oi" }, "errada")).status, 401);
    assert.equal((await fetch(url + "/health")).status, 200, "health sem chave");
    const ok = await post("/message/sendButtons/inst_1", { number: "5511912345678", description: "x", buttons: [{ displayText: "A", id: "a_1" }] });
    assert.equal(ok.status, 201); assert.equal((await ok.json()).key.id, "MSG1");
    assert.equal(calls.at(-1)[0], "send"); assert.equal(calls.at(-1)[1], "inst_1");
    assert.equal((await post("/message/sendText/..%2Fetc", { number: "5511912345678", text: "x" })).status, 400, "path traversal");
    assert.equal((await post("/message/sendText/inst_1", { number: "5511912345678", text: "x".repeat(5000) })).status, 413, "corpo grande");
    assert.equal((await post("/message/sendText/inst_1", { number: "120363@g.us", text: "x" })).status, 400);
    assert.equal((await post("/nada/inst_1", {})).status, 404);
  } finally { server.close(); }
});

test("mídia: só https das origens permitidas, sem redirecionamento, com limite de tamanho", async () => {
  const origins = ["https://proj.supabase.co"];
  for (const u of ["http://proj.supabase.co/a.png", "https://169.254.169.254/latest", "https://evil.com/a.png", "https://user:pw@proj.supabase.co/a", "file:///etc/passwd"]) {
    await assert.rejects(() => fetchMedia(u, { origins, maxBytes: 10, fetchImpl: () => { throw new Error("não devia buscar"); } }), /media_(origin_not_allowed|url_invalid)/, u);
  }
  let init;
  const small = await fetchMedia("https://proj.supabase.co/a.png", { origins, maxBytes: 10, fetchImpl: async (_u, i) => { init = i; return new Response("12345", { headers: { "content-type": "image/png" } }); } });
  assert.equal(small.buffer.toString(), "12345"); assert.equal(init.redirect, "error");
  await assert.rejects(() => fetchMedia("https://proj.supabase.co/a.png", { origins, maxBytes: 3, fetchImpl: async () => new Response("12345") }), /media_too_large/);
});

test("webhook: fila durável em ordem, tenta de novo em falha temporária e separa rejeitados", async () => {
  const dir = tmp(); let now = 1_000; const sent = []; let mode = "retry";
  const box = new WebhookOutbox(dir, async (env) => { sent.push(env.n); return env.n === 2 ? "reject" : mode; }, { now: () => now });
  box.enqueue({ n: 1 }); box.enqueue({ n: 2 }); box.enqueue({ n: 3 });
  assert.equal(await box.flush(), 0); assert.equal(box.pending().length, 3, "falhou: nada some");
  assert.equal(await box.flush(), 0); assert.deepEqual(sent, [1], "espera antes de repetir, sem pular a ordem");
  now += 10_000; mode = "ok";
  assert.equal(await box.flush(), 2); assert.deepEqual(sent, [1, 1, 2, 3]);
  assert.equal(box.pending().length, 0); assert.equal(fs.readdirSync(path.join(dir, "failed")).length, 1, "rejeitado vai para failed/");
});

test("eventos: formato que o webhook do AgendaFácil já lê (clique em botão/lista, LID com número, recibos)", () => {
  const env = upsertEnvelope("inst_1", [
    { key: { remoteJid: "5511912345678@s.whatsapp.net", fromMe: false, id: "A1" }, pushName: "Ana", message: { buttonsResponseMessage: { selectedButtonId: "confirm_yes", selectedDisplayText: "✅ Confirmar" } }, messageTimestamp: 1794500000 },
    { key: { remoteJid: "123@lid", senderPn: "5511987654321@s.whatsapp.net", fromMe: false, id: "A2" }, message: { listResponseMessage: { singleSelectReply: { selectedRowId: "ab12cd.1" } } } },
    { key: { remoteJid: "999@lid", fromMe: false, id: "A3" }, message: { conversation: "sem número real" } },
    { key: { remoteJid: "120363@g.us", fromMe: false, id: "A4" }, message: { conversation: "grupo" } },
  ], "5511951645271@s.whatsapp.net");
  assert.equal(env.event, "messages.upsert"); assert.equal(env.instance, "inst_1"); assert.equal(env.sender, "5511951645271@s.whatsapp.net");
  assert.deepEqual(env.data.map((d) => d.key.remoteJid), ["5511912345678@s.whatsapp.net", "5511987654321@s.whatsapp.net"]);
  assert.equal(env.data[0].message.buttonsResponseMessage.selectedButtonId, "confirm_yes");
  assert.equal(realJid({ remoteJid: "120363@g.us" }), null);
  const up = updateEnvelope("inst_1", [{ key: { id: "M1", fromMe: true, remoteJid: "x" }, update: { status: 3 } }, { key: { id: "M2", fromMe: false }, update: { status: 4 } }]);
  assert.deepEqual(up.data.map((d) => [d.key.id, d.update.status]), [["M1", 3]]);
});

test("instâncias: pastas isoladas, nome validado, webhook só para origem permitida", async () => {
  const dataDir = tmp();
  assert.throws(() => instanceDirs(dataDir, "../outro"), /instance_invalid/);
  const cfg = { ...loadConfig({ WHAILEYS_API_KEY: KEY, WHAILEYS_DATA_DIR: dataDir, WHAILEYS_WEBHOOK_ORIGINS: "https://proj.supabase.co" }), maxInstances: 2 };
  const m = new Manager(cfg, {});
  await m.create("salao_a", { url: "https://proj.supabase.co/functions/v1/evolution-webhook", headers: { "x-syshair-webhook-secret": "s".repeat(32) } });
  await assert.rejects(() => m.create("salao_b", { url: "https://evil.com/hook" }), /webhook_origin_not_allowed/);
  await assert.rejects(() => m.create("salao_c", { url: "http://proj.supabase.co/hook" }), /webhook_origin_not_allowed/);
  await m.create("salao_b");
  await assert.rejects(() => m.create("salao_d"), /instance_limit/);
  assert.equal(m.webhookOf(m.existing("salao_a")).headers["x-syshair-webhook-secret"], "s".repeat(32));
  assert.equal(m.webhookOf(m.existing("salao_b")), null, "um salão não herda o webhook de outro");
  assert.throws(() => m.ready("salao_a"), /instance_not_connected/);
  assert.throws(() => m.existing("nao_existe"), /instance_not_found/);
});

test("envio e Status: lotes com o mesmo id, histórico e reconexão sem novo QR", async () => {
  const dataDir = tmp();
  const cfg = { ...loadConfig({ WHAILEYS_API_KEY: KEY, WHAILEYS_DATA_DIR: dataDir }), statusBatch: 2 };
  const m = new Manager(cfg, {});
  const s = m.session("salao_a");
  const out = [];
  s.state = "open"; s.sock = { sendMessage: async (jid, msg, opt) => { out.push({ jid, msg, opt }); return { key: { id: opt?.messageId ?? `ID${out.length}` }, message: msg }; } };
  const r = await m.send("salao_a", P.buttonsMessage({ number: "5511912345678", description: "x", buttons: [{ displayText: "A", id: "a_1" }] }));
  assert.equal(r.key.id, "ID1"); assert.equal(s.history.find({ id: "ID1" }).length, 1);
  const st = await m.status("salao_a", P.statusMessage({ type: "text", content: "oi", statusJidList: ["5511911111111", "5511922222222", "5511933333333"] }));
  const batches = out.filter((o) => o.jid === "status@broadcast");
  assert.equal(batches.length, 2); assert.equal(batches[1].opt.messageId, st.key.id, "mesma publicação nos dois lotes");
  assert.equal(batches[0].opt.backgroundColor, "#2563EB");
});

test("pasta de Status: agenda em horário do salão, legenda, nunca republica", async () => {
  const root = tmp(); const posted = [];
  let now = new Date("2026-11-13T11:59:00Z"); // 08:59 em Brasília
  const f = new StatusFolder(root, async (item) => posted.push(item), { now: () => now });
  fs.writeFileSync(path.join(f.inbox, "01-promo.jpg"), "img");
  fs.writeFileSync(path.join(f.inbox, "02-video.mp4"), "vid");
  fs.writeFileSync(path.join(f.inbox, "captions.json"), JSON.stringify({ "01-promo.jpg": "Promoção da semana" }));
  f.saveConfig({ enabled: true, times: ["09:00", "18:00"], timezoneOffsetMin: -180, lastRun: now.toISOString() });
  assert.equal(await f.tick(), null, "antes do horário");
  now = new Date("2026-11-13T12:00:30Z");
  assert.deepEqual(await f.tick(), { posted: "01-promo.jpg" });
  assert.equal(posted[0].caption, "Promoção da semana"); assert.equal(posted[0].type, "image");
  assert.equal(await f.tick(), null, "mesmo horário não publica duas vezes");
  assert.ok(fs.existsSync(path.join(f.inbox, "posted", "01-promo.jpg")));
  assert.equal(nextSlot(["18:00"], new Date("2026-11-13T21:30:00Z")).toISOString(), "2026-11-14T21:00:00.000Z", "passou das 18h: amanhã");
});

test("histórico: contatos sem duplicar e busca por id", () => {
  const h = new History(path.join(tmp(), "h.jsonl"), { max: 3 });
  h.add([{ key: { remoteJid: "a@s.whatsapp.net", fromMe: false, id: "1" }, pushName: "Ana" }, { key: { remoteJid: "a@s.whatsapp.net", fromMe: true, id: "2" } }]);
  h.add([{ key: { remoteJid: "b@s.whatsapp.net", fromMe: false, id: "3" } }, { key: { remoteJid: "c@s.whatsapp.net", fromMe: false, id: "4" } }]);
  assert.equal(h.rows.length, 3, "limite");
  assert.equal(new History(h.file).rows.length, 3, "persistido");
  assert.equal(h.find({ id: "4" })[0].key.remoteJid, "c@s.whatsapp.net");
});

test("configuração: chave forte obrigatória e origens só https", () => {
  assert.throws(() => loadConfig({ WHAILEYS_API_KEY: "curta" }), /WHAILEYS_API_KEY/);
  assert.throws(() => loadConfig({ WHAILEYS_API_KEY: KEY, WHAILEYS_WEBHOOK_ORIGINS: "http://x.com" }), /origem inválida/);
  assert.deepEqual(loadConfig({ WHAILEYS_API_KEY: KEY, WHAILEYS_MEDIA_ORIGINS: "https://a.supabase.co/storage, https://b.com" }).mediaOrigins, ["https://a.supabase.co", "https://b.com"]);
});
