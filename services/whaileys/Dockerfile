# Serviço da conexão "QR Code com botões" (whaileys). Sessões e filas ficam em /data (monte um volume).
FROM node:22-alpine
# git: a whaileys depende do libsignal direto do GitHub.
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json* ./
# --ignore-scripts: nenhuma dependência roda script de instalação.
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY lib ./lib
COPY server.mjs ./
ENV NODE_ENV=production WHAILEYS_DATA_DIR=/data PORT=8080
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "server.mjs"]
