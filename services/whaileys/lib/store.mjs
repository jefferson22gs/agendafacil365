// Persistência em arquivos (volume do servidor): configuração por instância, webhook e fila durável de entrega.
// Escrita atômica (arquivo temporário + rename) para não corromper com queda de energia ou reinício.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const NAME = /^[A-Za-z0-9_-]{1,100}$/;

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

/** Pastas da instância. O nome é validado antes de qualquer acesso ao disco (sem "..", barras ou caracteres especiais). */
export function instanceDirs(dataDir, name) {
  if (!NAME.test(name)) { const e = new Error("instance_invalid"); e.status = 400; throw e; }
  const root = path.join(dataDir, "instances", name);
  return { root, auth: path.join(root, "auth"), config: path.join(root, "config.json"), outbox: path.join(root, "webhook-outbox"), history: path.join(root, "history.jsonl") };
}

export function listInstances(dataDir) {
  try { return fs.readdirSync(path.join(dataDir, "instances")).filter((n) => NAME.test(n)); } catch { return []; }
}

/**
 * Fila durável do webhook: cada evento vira um arquivo; só é apagado depois que o AgendaFácil responde 2xx.
 * Falha temporária tenta de novo com espera crescente; 4xx (rejeitado) vai para failed/ e não repete.
 */
export class WebhookOutbox {
  constructor(dir, send, { maxAttempts = 12, now = () => Date.now() } = {}) {
    this.dir = dir; this.send = send; this.maxAttempts = maxAttempts; this.now = now; this.running = false; this.seq = 0;
    fs.mkdirSync(path.join(dir, "failed"), { recursive: true });
  }
  enqueue(envelope) {
    // Horário + sequência: dois eventos no mesmo milissegundo mantêm a ordem de chegada.
    const id = `${String(this.now()).padStart(15, "0")}-${String(this.seq++).padStart(9, "0")}-${crypto.randomUUID()}`;
    writeJson(path.join(this.dir, `${id}.json`), { envelope, attempts: 0, next: 0 });
    return id;
  }
  pending() {
    return fs.readdirSync(this.dir).filter((f) => f.endsWith(".json")).sort();
  }
  /** Envia o que venceu, em ordem. Retorna quantos foram entregues. */
  async flush() {
    if (this.running) return 0;
    this.running = true;
    let delivered = 0;
    try {
      for (const f of this.pending()) {
        const file = path.join(this.dir, f), item = readJson(file);
        if (!item) { fs.renameSync(file, path.join(this.dir, "failed", f)); continue; }
        if (item.next > this.now()) break; // mantém a ordem: não pula na frente de um evento que está esperando
        const result = await this.send(item.envelope).catch(() => "retry");
        if (result === "ok") { fs.rmSync(file, { force: true }); delivered++; continue; }
        item.attempts++;
        if (result === "reject" || item.attempts >= this.maxAttempts) { fs.renameSync(file, path.join(this.dir, "failed", f)); continue; }
        item.next = this.now() + Math.min(300_000, 2_000 * 2 ** (item.attempts - 1));
        writeJson(file, item);
        break;
      }
    } finally { this.running = false; }
    return delivered;
  }
}

/** Histórico local por instância (últimas mensagens), para /chat/findMessages e /chat/findContacts. */
export class History {
  constructor(file, { max = 5000 } = {}) { this.file = file; this.max = max; this.rows = this.load(); }
  load() {
    try { return fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).slice(-this.max); } catch { return []; }
  }
  add(rows) {
    if (!rows.length) return;
    this.rows.push(...rows);
    if (this.rows.length > this.max) this.rows = this.rows.slice(-this.max);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // ponytail: reescreve o arquivo inteiro (até `max` linhas, ~1 MB). Trocar por SQLite se o volume crescer muito.
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, this.rows.map((r) => JSON.stringify(r)).join("\n") + "\n", { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  find({ id, remoteJid, fromMe } = {}, limit = 50) {
    return this.rows.filter((r) => (!id || r.key?.id === id) && (!remoteJid || r.key?.remoteJid === remoteJid) && (fromMe === undefined || r.key?.fromMe === fromMe)).slice(-limit).reverse();
  }
  contacts() {
    const seen = new Map();
    for (const r of this.rows) {
      const jid = r.key?.remoteJid;
      if (jid && !r.key.fromMe && r.pushName) seen.set(jid, { remoteJid: jid, pushName: r.pushName });
      else if (jid && !seen.has(jid)) seen.set(jid, { remoteJid: jid, pushName: null });
    }
    return [...seen.values()];
  }
}
