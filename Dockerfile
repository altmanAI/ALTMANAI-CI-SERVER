FROM node:22.16.0-alpine AS runtime

LABEL org.opencontainers.image.title="AltmanAI CI Server" \
      org.opencontainers.image.description="Human-authorized CI governance and tamper-evident evidence service" \
      org.opencontainers.image.vendor="AltmanAI by Altman Family Group LLC" \
      org.opencontainers.image.version="0.2.0"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    EVIDENCE_LEDGER_PATH=/app/data/evidence.ndjson \
    EVIDENCE_BACKUP_DIR=/app/data/backups

WORKDIR /app

RUN addgroup -S altmanai && adduser -S altmanai -G altmanai

COPY --chown=altmanai:altmanai package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY --chown=altmanai:altmanai src ./src
COPY --chown=altmanai:altmanai scripts ./scripts
COPY --chown=altmanai:altmanai config ./config
RUN mkdir -p /app/data/backups \
    && chown -R altmanai:altmanai /app/data

USER altmanai
EXPOSE 8080
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
