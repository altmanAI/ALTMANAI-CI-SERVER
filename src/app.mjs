import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { verifyGitHubSignature, sha256 } from './crypto.mjs';

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders
  });
  res.end(payload);
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      const error = new Error('Request body exceeds configured limit');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function clientAddress(req, trustProxyHeaders) {
  if (trustProxyHeaders) {
    const flyClientIp = req.headers['fly-client-ip'];
    if (flyClientIp) return String(flyClientIp).trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function createFixedWindowRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  return {
    consume(key, now = Date.now()) {
      if (buckets.size > 10_000) {
        for (const [bucketKey, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(bucketKey);
        }
      }

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
        };
      }

      bucket.count += 1;
      return { allowed: true, remaining: Math.max(0, max - bucket.count) };
    }
  };
}

function validWebhookSignature(config, signatureHeader, rawBody) {
  const secrets = [config.webhookSecret, config.webhookSecretPrevious].filter(Boolean);
  return secrets.some((secret) => verifyGitHubSignature({ secret, signatureHeader, rawBody }));
}

export function createApp({ config, processor, ledger, logger, startedAt = Date.now() }) {
  const webhookRateLimiter = createFixedWindowRateLimiter({
    windowMs: config.webhookRateLimitWindowMs || 60_000,
    max: config.webhookRateLimitMax || 120
  });

  return createHttpServer(async (req, res) => {
    const requestId = String(req.headers['x-request-id'] || randomUUID());
    const started = Date.now();
    const remoteAddress = clientAddress(req, Boolean(config.trustProxyHeaders));
    try {
      if (req.method === 'GET' && req.url === '/healthz') {
        return json(res, 200, { status: 'ok', service: config.serviceName, version: config.serviceVersion });
      }

      if (req.method === 'GET' && req.url === '/readyz') {
        const ledgerStatus = await ledger.verify();
        return json(res, ledgerStatus.valid ? 200 : 503, {
          status: ledgerStatus.valid ? 'ready' : 'not_ready',
          ledger: ledgerStatus
        });
      }

      if (req.method === 'GET' && req.url === '/v1/status') {
        return json(res, 200, {
          service: config.serviceName,
          version: config.serviceVersion,
          environment: config.nodeEnv,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          policyVersion: config.policy.policyVersion,
          policyDigest: sha256(JSON.stringify(config.policy))
        });
      }

      if (req.method === 'POST' && req.url === '/webhooks/github') {
        const rateLimit = webhookRateLimiter.consume(remoteAddress);
        if (!rateLimit.allowed) {
          logger.warn('Webhook rate limit exceeded', {
            requestId,
            remoteAddress,
            retryAfterSeconds: rateLimit.retryAfterSeconds
          });
          return json(
            res,
            429,
            { error: 'rate_limit_exceeded', requestId },
            { 'Retry-After': String(rateLimit.retryAfterSeconds) }
          );
        }

        const rawBody = await readBody(req, config.maxBodyBytes);
        const signatureHeader = req.headers['x-hub-signature-256'];
        if (!validWebhookSignature(config, signatureHeader, rawBody)) {
          logger.warn('Webhook signature rejected', { requestId, remoteAddress });
          return json(res, 401, { error: 'invalid_webhook_signature', requestId });
        }

        let payload;
        try {
          payload = JSON.parse(rawBody.toString('utf8'));
        } catch {
          return json(res, 400, { error: 'invalid_json', requestId });
        }

        const result = await processor.process({
          event: req.headers['x-github-event'] || 'unknown',
          deliveryId: req.headers['x-github-delivery'] || null,
          payload
        });
        return json(res, 202, { requestId, ...result });
      }

      return json(res, 404, { error: 'not_found', requestId });
    } catch (error) {
      logger.error('Request failed', {
        requestId,
        method: req.method,
        url: req.url,
        remoteAddress,
        error: error.message,
        status: error.status || 500
      });
      return json(res, error.status || 500, {
        error: error.status && error.status < 500 ? error.message : 'internal_server_error',
        requestId
      });
    } finally {
      logger.debug('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        remoteAddress,
        durationMs: Date.now() - started
      });
    }
  });
}
