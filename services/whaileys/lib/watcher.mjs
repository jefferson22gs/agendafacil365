// Status automático a partir de uma pasta NO SERVIDOR (por instância): o dono coloca fotos/vídeos em
// data/instances/<nome>/status-inbox/, com legendas opcionais em captions.json ({ "arquivo.jpg": "legenda" }).
// Nos horários configurados, publica o próximo arquivo e move para posted/ (ou failed/). Nunca republica.
import fs from "node:fs";
import path from "node:path";

const MEDIA = { ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".mp4": "video" };

export function nextSlot(times, now, timezoneOffsetMin = -180) {
  // Horários "HH:MM" no fuso do salão (padrão Brasília, -03:00). Retorna o instante UTC do próximo horário.
  const local = new Date(now.getTime() + timezoneOffsetMin * 60_000);
  const valid = times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).sort();
  for (let day = 0; day < 2; day++) {
    for (const t of valid) {
      const [h, m] = t.split(":").map(Number);
      const slot = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + day, h, m) - timezoneOffsetMin * 60_000;
      if (slot > now.getTime()) return new Date(slot);
    }
  }
  return null;
}

export class StatusFolder {
  /**
   * @param root pasta da instância
   * @param post (item) => Promise<void>  publica { type, buffer, caption }
   */
  constructor(root, post, { now = () => new Date() } = {}) {
    this.inbox = path.join(root, "status-inbox");
    this.post = post; this.now = now;
    for (const d of ["", "posted", "failed"]) fs.mkdirSync(path.join(this.inbox, d), { recursive: true });
    this.configFile = path.join(this.inbox, "schedule.json");
  }
  config() {
    try {
      const c = JSON.parse(fs.readFileSync(this.configFile, "utf8"));
      return { enabled: c.enabled === true, times: Array.isArray(c.times) ? c.times : [], timezoneOffsetMin: Number.isFinite(c.timezoneOffsetMin) ? c.timezoneOffsetMin : -180, lastRun: c.lastRun ?? null };
    } catch { return { enabled: false, times: [], timezoneOffsetMin: -180, lastRun: null }; }
  }
  saveConfig(c) { fs.writeFileSync(this.configFile, JSON.stringify(c, null, 2)); }
  captions() {
    try { return JSON.parse(fs.readFileSync(path.join(this.inbox, "captions.json"), "utf8")); } catch { return {}; }
  }
  /** Arquivos na fila, em ordem alfabética (o dono controla a ordem pelo nome: 01-..., 02-...). */
  queue() {
    return fs.readdirSync(this.inbox, { withFileTypes: true })
      .filter((e) => e.isFile() && MEDIA[path.extname(e.name).toLowerCase()])
      .map((e) => e.name).sort();
  }
  /** Chamado a cada minuto: publica um arquivo se passou um horário configurado desde a última execução. */
  async tick() {
    const c = this.config();
    if (!c.enabled || !c.times.length) return null;
    const now = this.now();
    const since = c.lastRun ? new Date(c.lastRun) : new Date(now.getTime() - 60_000);
    const due = nextSlot(c.times, since, c.timezoneOffsetMin);
    if (!due || due > now) return null;
    this.saveConfig({ ...c, lastRun: now.toISOString() }); // marca antes de publicar: queda no meio não duplica
    const [file] = this.queue();
    if (!file) return null;
    const full = path.join(this.inbox, file);
    const caption = this.captions()[file];
    try {
      await this.post({ type: MEDIA[path.extname(file).toLowerCase()], buffer: fs.readFileSync(full), caption: typeof caption === "string" ? caption.slice(0, 700) : undefined });
      fs.renameSync(full, path.join(this.inbox, "posted", file));
      return { posted: file };
    } catch (e) {
      fs.renameSync(full, path.join(this.inbox, "failed", file));
      return { failed: file, error: String(e?.message ?? e).slice(0, 200) };
    }
  }
}
