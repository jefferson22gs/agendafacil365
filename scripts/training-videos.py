# Converte as videoaulas (1080p, ~10 MB cada) para a web: 720p H.264 + AAC mono, faststart, e gera a capa (webp).
# Uso: python scripts/training-videos.py "<pasta com os .mp4 originais>"   (saída em public/training/videos)
# Requer ffmpeg (pip install imageio-ffmpeg). O número no início do arquivo define a aula; a ordem está em SLUGS.
import os, subprocess, sys
import imageio_ffmpeg

SLUGS = ["pagina-oficial", "dashboard", "agendamentos", "clientes", "profissionais", "servicos", "retornos-lembretes", "financeiro",
         "analytics", "pacotes", "cupons", "produtos", "multi-unidades", "recursos-avancados", "whatsapp-visao-geral", "whatsapp-conversas",
         "whatsapp-disparador", "whatsapp-status", "whatsapp-chatbot-ia", "whatsapp-fluxo-agendamento", "whatsapp-contatos",
         "whatsapp-conexao", "marketing", "avaliacoes", "galeria", "configuracoes", "minha-assinatura", "contrato-central-treinamento"]

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "training", "videos")
os.makedirs(out, exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
files = sorted(f for f in os.listdir(src) if f.lower().endswith(".mp4"))
assert len(files) == len(SLUGS), f"esperava {len(SLUGS)} vídeos, achei {len(files)}"
for f in files:
    n = int(f[:2])
    base = os.path.join(out, f"{n:02d}-{SLUGS[n - 1]}")
    path = os.path.join(src, f)
    if not os.path.exists(base + ".mp4"):
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "slow",
                        "-crf", "29", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", base + ".tmp.mp4"], check=True)
        os.replace(base + ".tmp.mp4", base + ".mp4")
    if not os.path.exists(base + ".webp"):
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-ss", "22", "-i", path, "-frames:v", "1", "-vf", "scale=640:-2", "-quality", "72", base + ".webp"], check=True)
    print(f"{n:02d} {os.path.getsize(base + '.mp4') / 1e6:.1f} MB", flush=True)
print("total MB", round(sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6, 1))
