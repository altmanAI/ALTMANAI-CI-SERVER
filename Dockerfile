FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

RUN addgroup -S altmanai && adduser -S altmanai -G altmanai

COPY --chown=altmanai:altmanai package.json ./
COPY --chown=altmanai:altmanai src ./src
COPY --chown=altmanai:altmanai scripts ./scripts
COPY --chown=altmanai:altmanai config ./config
RUN mkdir -p /app/data && chown altmanai:altmanai /app/data

USER altmanai
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
