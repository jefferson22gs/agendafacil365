// Serviço da terceira conexão (QR Code com botões). Mesmas rotas da Evolution: o AgendaFácil só troca a URL e a chave.
import http from "node:http";
import pino from "pino";
import whaileysCjs from "whaileys";
import { loadConfig } from "./lib/config.mjs";
import { createHandler } from "./lib/http.mjs";
import { Manager } from "./lib/manager.mjs";

const cfg = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL || "info", redact: ["*.apikey", "*.headers", "*.secret"] });
const log = (msg, extra = {}) => logger.info(extra, msg);
// Logs internos da whaileys (muito verbosos e com dados de sessão) ficam desligados.
// whaileys é CommonJS: a fábrica do socket fica em `.default` do módulo; os utilitários, no próprio módulo.
const lib = { ...whaileysCjs, default: whaileysCjs.default ?? whaileysCjs.makeWASocket, pinoSilent: pino({ level: "silent" }) };
if (typeof lib.default !== "function") throw new Error("whaileys: fábrica do socket não encontrada");

const manager = new Manager(cfg, lib, { log });
await manager.boot();
const server = http.createServer(createHandler(manager, { apiKey: cfg.apiKey, maxBodyBytes: cfg.maxBodyBytes, log }));
server.requestTimeout = 150_000; // Status com muitos contatos responde só no fim
server.listen(cfg.port, cfg.host, () => log("listening", { port: cfg.port }));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
