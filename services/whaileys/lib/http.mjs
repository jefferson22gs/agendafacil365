// Roteador HTTP com o mesmo contrato da Evolution 2.3.7 que o AgendaFácil já chama (apikey no cabeçalho).
// Não conhece a whaileys: recebe um `manager` com as operações. Assim o contrato é testado sem WhatsApp.
import crypto from "node:crypto";
import * as P from "./payloads.mjs";

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
};
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function readBody(req, max) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error("body_too_large"), { status: 413 });
    chunks.push(c);
  }
  if (!size) return {};
  try { const v = JSON.parse(Buffer.concat(chunks).toString("utf8")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  catch { throw Object.assign(new Error("json_invalid"), { status: 400 }); }
}

/** Rotas: [método, prefixo, handler(manager, nome, corpo, query)]. O nome vem no fim do caminho, como na Evolution. */
const ROUTES = [
  ["POST", "/instance/create", (m, _n, b) => m.create(String(b.instanceName ?? ""), b.webhook)],
  ["GET", "/instance/connect/", (m, n) => m.connect(n)],
  ["GET", "/instance/connectionState/", (m, n) => m.state(n)],
  ["GET", "/instance/fetchInstances", (m, _n, _b, q) => m.fetch(q.get("instanceName") ?? "")],
  ["DELETE", "/instance/logout/", (m, n) => m.logout(n)],
  ["DELETE", "/instance/delete/", (m, n) => m.remove(n)],
  ["POST", "/webhook/set/", (m, n, b) => m.setWebhook(n, b.webhook ?? b)],
  ["POST", "/chat/findContacts/", (m, n) => m.contacts(n)],
  ["POST", "/chat/findChats/", (m, n) => m.contacts(n)],
  ["POST", "/chat/findMessages/", (m, n, b) => m.messages(n, b)],
  ["POST", "/chat/sendPresence/", (m, n, b) => m.presence(n, P.presenceOf(b))],
  ["POST", "/chat/getBase64FromMediaMessage/", (m, n, b) => m.mediaBase64(n, b)],
  ["GET", "/settings/find/", (m, n) => m.settings(n)],
  ["POST", "/settings/set/", (m, n, b) => m.setSettings(n, b)],
  ["POST", "/message/sendText/", (m, n, b) => m.send(n, P.textMessage(b))],
  ["POST", "/message/sendButtons/", (m, n, b) => m.send(n, P.buttonsMessage(b))],
  ["POST", "/message/sendList/", (m, n, b) => m.send(n, P.listMessage(b))],
  ["POST", "/message/sendPoll/", (m, n, b) => m.send(n, P.pollMessage(b))],
  ["POST", "/message/sendMedia/", (m, n, b) => m.send(n, P.mediaMessage(b))],
  ["POST", "/message/sendStatus/", (m, n, b) => m.status(n, P.statusMessage(b))],
  // Pasta de Status no servidor (agenda + legendas): ler e ajustar por instância.
  ["GET", "/status-folder/", (m, n) => m.statusFolder(n)],
  ["POST", "/status-folder/", (m, n, b) => m.setStatusFolder(n, b)],
];

export function createHandler(manager, { apiKey, maxBodyBytes = 1_000_000, log = () => {} }) {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    try {
      if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
      if (!safeEqual(req.headers.apikey ?? "", apiKey)) return json(res, 401, { error: "unauthorized" });
      const route = ROUTES.find(([method, prefix]) => req.method === method && (url.pathname === prefix || (prefix.endsWith("/") && url.pathname.startsWith(prefix))));
      if (!route) return json(res, 404, { error: "not_found" });
      const [, prefix, handler] = route;
      const name = prefix.endsWith("/") ? decodeURIComponent(url.pathname.slice(prefix.length)) : "";
      if (prefix.endsWith("/") && !/^[A-Za-z0-9_-]{1,100}$/.test(name)) return json(res, 400, { error: "instance_invalid" });
      const body = req.method === "POST" ? await readBody(req, maxBodyBytes) : {};
      const out = await handler(manager, name, body, url.searchParams);
      return json(res, route[0] === "POST" && /^\/(message|instance\/create)/.test(prefix) ? 201 : 200, out ?? { ok: true });
    } catch (e) {
      const status = Number(e?.status) || 500;
      if (status >= 500) log("request_failed", { path: url.pathname, code: String(e?.code ?? e?.message ?? "error").slice(0, 80) });
      return json(res, status, { error: status >= 500 ? "internal_error" : String(e?.code ?? e?.message ?? "bad_request").slice(0, 80) });
    }
  };
}
