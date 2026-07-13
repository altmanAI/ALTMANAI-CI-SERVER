# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.title="AltmanAI CI Server" \
      org.opencontainers.image.description="Human-authorized CI governance and tamper-evident proof service" \
      org.opencontainers.image.vendor="Altman Family Group LLC"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    EVIDENCE_LEDGER_PATH=/app/data/evidence.ndjson

WORKDIR /app

RUN apk add --no-cache tini \
    && addgroup -S -g 10001 altmanai \
    && adduser -S -D -H -u 10001 -G altmanai altmanai \
    && mkdir -p /app/data/backups \
    && chown -R altmanai:altmanai /app

COPY --chown=altmanai:altmanai package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY --chown=altmanai:altmanai src ./src
COPY --chown=altmanai:altmanai scripts ./scripts
COPY --chown=altmanai:altmanai config ./config

USER 10001:10001
EXPOSE 8080
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.mjs"]
