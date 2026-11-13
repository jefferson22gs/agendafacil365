// Gerencia uma sessão whaileys por instância (um salão = uma instância). Reconexão automática, QR em base64,
// webhook durável para o AgendaFácil e histórico local. A IA e as regras do robô ficam no AgendaFácil.
import fs from "node:fs";
import QRCode from "qrcode";
import { connectionEnvelope, realJid, updateEnvelope, upsertEnvelope } from "./events.mjs";
import { inlineMedia } from "./media.mjs";
import { History, NAME, WebhookOutbox, instanceDirs, listInstances, readJson, writeJson } from "./store.mjs";
import { StatusFolder } from "./watcher.mjs";

const err = (status, code) => Object.assign(new Error(code), { status, code });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Manager {
  /**
   * @param cfg configuração (lib/config.mjs)
   * @param lib módulo whaileys (injetável nos testes)
   */
  constructor(cfg, lib, { fetchImpl = fetch, log = () => {} } = {}) {
    this.cfg = cfg; this.lib = lib; this.fetch = fetchImpl; this.log = log;
    this.sessions = new Map();
  }

  /** Reabre as instâncias que já tinham sessão salva (reinício do serviço não exige novo QR). */
  async boot() {
    for (const name of listInstances(this.cfg.dataDir)) {
      const dirs = instanceDirs(this.cfg.dataDir, name);
      if (fs.existsSync(dirs.auth) && fs.readdirSync(dirs.auth).length) await this.start(name).catch((e) => this.log("boot_failed", { name, code: e?.code ?? "error" }));
      else this.session(name);
    }
    setInterval(() => { for (const s of this.sessions.values()) { void s.outbox.flush(); void s.folder.tick().then((r) => r && this.log("status_folder", { name: s.name, ...r })).catch(() => {}); } }, 15_000).unref();
  }

  /** Estado em memória da instância (cria pastas e fila, sem abrir conexão). */
  session(name) {
    if (!NAME.test(name)) throw err(400, "instance_invalid");
    let s = this.sessions.get(name);
    if (s) return s;
    const dirs = instanceDirs(this.cfg.dataDir, name);
    fs.mkdirSync(dirs.root, { recursive: true, mode: 0o700 });
    s = { name, dirs, sock: null, state: "close", qr: null, owner: null, closing: false, retries: 0, settings: readJson(dirs.config, {})?.settings ?? {} };
    s.history = new History(dirs.history);
    s.outbox = new WebhookOutbox(dirs.outbox, (env) => this.deliver(s, env));
    s.folder = new StatusFolder(dirs.root, (item) => this.postFolderStatus(s, item));
    this.sessions.set(name, s);
    return s;
  }
  existing(name) {
    const s = this.sessions.get(name);
    if (!s) throw err(404, "instance_not_found");
    return s;
  }
  webhookOf(s) { return readJson(s.dirs.config, {})?.webhook ?? null; }

  /** Webhook só para origens permitidas, com o segredo que o AgendaFácil confere (x-syshair-webhook-secret). */
  saveWebhook(s, webhook) {
    if (!webhook || webhook.enabled === false) { writeJson(s.dirs.config, { ...readJson(s.dirs.config, {}), webhook: null }); return; }
    let url;
    try { url = new URL(String(webhook.url)); } catch { throw err(400, "webhook_url_invalid"); }
    if (url.protocol !== "https:" || url.username || url.password || !this.cfg.webhookOrigins.includes(url.origin)) throw err(400, "webhook_origin_not_allowed");
    const headers = {};
    const secret = webhook.headers?.["x-syshair-webhook-secret"];
    if (typeof secret === "string" && secret.length >= 16 && secret.length <= 128) headers["x-syshair-webhook-secret"] = secret;
    writeJson(s.dirs.config, { ...readJson(s.dirs.config, {}), webhook: { url: url.href, headers } });
  }

  async deliver(s, envelope) {
    const hook = this.webhookOf(s);
    if (!hook) return "ok"; // sem webhook configurado: nada a entregar
    const res = await this.fetch(hook.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json", ...hook.headers }, body: JSON.stringify(envelope) });
    if (res.ok) return "ok";
    return res.status === 429 || res.status >= 500 ? "retry" : "reject";
  }
  emit(s, envelope) {
    if (!envelope) return;
    s.outbox.enqueue(envelope);
    void s.outbox.flush();
  }

  // ------------------------------------------------------------------------------------------- conexão
  async start(name) {
    const s = this.session(name);
    if (s.sock && s.state !== "close") return s;
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = this.lib;
    const { state, saveCreds } = await useMultiFileAuthState(s.dirs.auth);
    let version;
    try { version = (await fetchLatestBaileysVersion()).version; } catch { version = undefined; }
    s.closing = false;
    s.state = "connecting";
    const sock = makeWASocket({
      auth: state, printQRInTerminal: false, browser: Browsers.ubuntu(this.cfg.browserName), syncFullHistory: false,
      markOnlineOnConnect: false, ...(version ? { version } : {}), logger: this.lib.pinoSilent,
    });
    s.sock = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (u) => void this.onConnection(s, sock, u, DisconnectReason));
    sock.ev.on("messages.upsert", ({ messages }) => {
      const env = upsertEnvelope(s.name, messages, s.owner);
      if (!env) return;
      s.history.add(env.data);
      if (s.settings.readMessages) for (const m of messages) if (!m.key?.fromMe && m.key) void sock.readMessages([m.key]).catch(() => {});
      this.emit(s, env);
    });
    sock.ev.on("messages.update", (updates) => this.emit(s, updateEnvelope(s.name, updates)));
    return s;
  }

  async onConnection(s, sock, u, DisconnectReason) {
    if (sock !== s.sock) return; // evento de um socket antigo
    if (u.qr) s.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }).catch(() => null);
    if (u.connection === "open") {
      s.state = "open"; s.qr = null; s.retries = 0;
      s.owner = String(sock.user?.id ?? "").replace(/:\d+(?=@)/, "") || null;
      this.emit(s, connectionEnvelope(s.name, "open"));
    } else if (u.connection === "connecting") s.state = "connecting";
    else if (u.connection === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      s.state = "close"; s.sock = null;
      this.emit(s, connectionEnvelope(s.name, "close"));
      if (loggedOut) { fs.rmSync(s.dirs.auth, { recursive: true, force: true }); s.owner = null; return; }
      if (s.closing) return;
      // Queda de rede/restart do WhatsApp: reconecta com espera crescente (máx. 60 s).
      s.retries++;
      await sleep(Math.min(60_000, 1_000 * 2 ** Math.min(s.retries, 6)));
      if (!s.closing && !s.sock) await this.start(s.name).catch((e) => this.log("reconnect_failed", { name: s.name, code: e?.code ?? "error" }));
    }
  }

  // ------------------------------------------------------------------------------------------- rotas
  async create(name, webhook) {
    if (!NAME.test(name)) throw err(400, "instance_invalid");
    const isNew = !this.sessions.has(name);
    if (isNew && this.sessions.size >= this.cfg.maxInstances) throw err(429, "instance_limit");
    const s = this.session(name);
    try { if (webhook) this.saveWebhook(s, webhook); }
    catch (e) {
      // Webhook recusado: a instância nova não fica criada pela metade (nem ocupa vaga do limite).
      if (isNew) { this.sessions.delete(name); fs.rmSync(s.dirs.root, { recursive: true, force: true }); }
      throw e;
    }
    return { instance: { instanceName: name, status: "created" } };
  }
  async connect(name) {
    const s = this.session(name);
    if (s.state === "open") return { instance: { instanceName: name, state: "open" } };
    await this.start(name);
    // Espera o primeiro QR (ou a reconexão com sessão salva) por até 15 s.
    for (let i = 0; i < 30 && !s.qr && s.state !== "open"; i++) await sleep(500);
    return s.qr ? { base64: s.qr, code: "qrcode" } : { instance: { instanceName: name, state: s.state } };
  }
  state(name) {
    const s = this.existing(name);
    return { instance: { instanceName: name, state: s.state } };
  }
  fetch(name) {
    const s = this.existing(name);
    return [{ instance: { instanceName: name, name, connectionStatus: s.state, ownerJid: s.owner } }];
  }
  async logout(name) {
    const s = this.existing(name);
    s.closing = true;
    await s.sock?.logout().catch(() => {});
    s.sock = null; s.state = "close"; s.qr = null; s.owner = null;
    fs.rmSync(s.dirs.auth, { recursive: true, force: true });
    return { status: "SUCCESS" };
  }
  async remove(name) {
    await this.logout(name).catch(() => {});
    this.sessions.delete(name);
    fs.rmSync(instanceDirs(this.cfg.dataDir, name).root, { recursive: true, force: true });
    return { status: "SUCCESS" };
  }
  setWebhook(name, webhook) { this.saveWebhook(this.session(name), webhook); return { webhook: { enabled: !!webhook } }; }
  contacts(name) { return this.existing(name).history.contacts(); }
  messages(name, body) {
    const where = body?.where?.key ?? {};
    const rows = this.existing(name).history.find({ id: where.id, remoteJid: where.remoteJid, fromMe: typeof where.fromMe === "boolean" ? where.fromMe : undefined }, Math.min(Number(body?.offset) || 50, 200));
    return { messages: { total: rows.length, pages: 1, currentPage: 1, records: rows } };
  }
  settings(name) { return { rejectCall: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false, ...this.existing(name).settings }; }
  setSettings(name, body) {
    const s = this.existing(name);
    s.settings = { groupsIgnore: body.groupsIgnore !== false, readMessages: body.readMessages === true };
    writeJson(s.dirs.config, { ...readJson(s.dirs.config, {}), settings: s.settings });
    return { settings: s.settings };
  }
  ready(name) {
    const s = this.existing(name);
    if (s.state !== "open" || !s.sock) throw err(409, "instance_not_connected");
    return s;
  }
  async presence(name, p) {
    const s = this.ready(name);
    await s.sock.sendPresenceUpdate(p.presence, p.jid).catch(() => {});
    if (p.delay) { await sleep(p.delay); await s.sock.sendPresenceUpdate("paused", p.jid).catch(() => {}); }
    return { presence: p.presence };
  }

  async send(name, { jid, content, mediaUrl }) {
    const s = this.ready(name);
    const message = await inlineMedia(content, mediaUrl, { origins: this.cfg.mediaOrigins, maxBytes: this.cfg.maxMediaBytes, fetchImpl: this.fetch });
    const sent = await s.sock.sendMessage(jid, message);
    if (sent?.key) s.history.add([{ key: { remoteJid: jid, fromMe: true, id: sent.key.id }, message: sent.message, messageTimestamp: Math.floor(Date.now() / 1000) }]);
    return { key: { remoteJid: jid, fromMe: true, id: sent?.key?.id }, status: "PENDING", messageTimestamp: Math.floor(Date.now() / 1000) };
  }

  /** Status em lotes (statusJidList), como a Evolution: a mesma publicação é enviada a cada lote com o mesmo id. */
  async status(name, { jids, content, options, mediaUrl }) {
    const s = this.ready(name);
    const message = await inlineMedia(content, mediaUrl, { origins: this.cfg.mediaOrigins, maxBytes: this.cfg.maxMediaBytes, fetchImpl: this.fetch });
    let id = null;
    for (let i = 0; i < jids.length; i += this.cfg.statusBatch) {
      const batch = jids.slice(i, i + this.cfg.statusBatch);
      const sent = await s.sock.sendMessage("status@broadcast", message, { ...options, statusJidList: batch, ...(id ? { messageId: id } : {}) });
      id ??= sent?.key?.id ?? null;
    }
    if (!id) throw err(502, "status_not_sent");
    return { key: { remoteJid: "status@broadcast", fromMe: true, id }, status: "PENDING" };
  }

  /** Status da pasta do servidor: publica para os contatos com quem a instância já conversou. */
  async postFolderStatus(s, { type, buffer, caption }) {
    if (s.state !== "open" || !s.sock) throw err(409, "instance_not_connected");
    const jids = s.history.contacts().map((c) => c.remoteJid).filter((j) => /^\d{7,15}@s\.whatsapp\.net$/.test(j));
    if (!jids.length) throw err(409, "no_audience");
    let id = null;
    for (let i = 0; i < jids.length; i += this.cfg.statusBatch) {
      const sent = await s.sock.sendMessage("status@broadcast", { [type]: buffer, ...(caption ? { caption } : {}) }, { statusJidList: jids.slice(i, i + this.cfg.statusBatch), ...(id ? { messageId: id } : {}) });
      id ??= sent?.key?.id ?? null;
    }
  }
  statusFolder(name) {
    const s = this.existing(name);
    return { ...s.folder.config(), queue: s.folder.queue(), captions: s.folder.captions() };
  }
  setStatusFolder(name, body) {
    const s = this.existing(name);
    const times = Array.isArray(body.times) ? body.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).slice(0, 24) : [];
    const c = s.folder.config();
    s.folder.saveConfig({ ...c, enabled: body.enabled === true, times, timezoneOffsetMin: Number.isFinite(body.timezoneOffsetMin) ? Math.max(-720, Math.min(840, body.timezoneOffsetMin)) : c.timezoneOffsetMin });
    return this.statusFolder(name);
  }

  /** Comprovante enviado pelo cliente (getBase64FromMediaMessage): baixa a mídia de uma mensagem do histórico. */
  async mediaBase64(name, body) {
    const s = this.ready(name);
    const id = body?.message?.key?.id;
    const row = typeof id === "string" ? s.history.find({ id }, 1)[0] : null;
    if (!row) throw err(404, "message_not_found");
    const buffer = await this.lib.downloadMediaMessage(row, "buffer", {}, { reuploadRequest: s.sock.updateMediaMessage });
    if (buffer.length > this.cfg.maxMediaBytes) throw err(413, "media_too_large");
    const m = row.message ?? {};
    const media = m.imageMessage ?? m.documentMessage ?? m.videoMessage ?? m.audioMessage ?? {};
    return { base64: buffer.toString("base64"), mimetype: media.mimetype ?? "application/octet-stream", fileName: media.fileName ?? null };
  }
}

export { realJid };
