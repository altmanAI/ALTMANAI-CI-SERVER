import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { verifyGitHubSignature, sha256 } from './crypto.mjs';

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
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

function headerString(value) {
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
}

function requestIdentifier(value) {
  const candidate = headerString(value).trim();
  return candidate && candidate.length <= 128 ? candidate : randomUUID();
}

function clientAddress(req, trustProxyHeaders) {
  if (trustProxyHeaders) {
    const flyClientIp = headerString(req.headers['fly-client-ip']).trim();
    if (flyClientIp) return flyClientIp;
    const forwarded = headerString(req.headers['x-forwarded-for']).split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

function createFixedWindowRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  let operations = 0;

  function prune(now) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    consume(key, now = Date.now()) {
      operations += 1;
      if (operations % 256 === 0 || buckets.size > 10_000) prune(now);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= max) {
        return {
          allowed: false,
          limit: max,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
        };
      }

      bucket.count += 1;
      return {
        allowed: true,
        limit: max,
        remaining: Math.max(0, max - bucket.count),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      };
    }
  };
}

export function createApp({ config, processor, ledger, logger, startedAt = Date.now() }) {
  const webhookRateLimiter = createFixedWindowRateLimiter({
    windowMs: config.webhookRateLimitWindowMs || 60_000,
    max: config.webhookRateLimitMax || 120
  });

  return createHttpServer(async (req, res) => {
    const requestId = requestIdentifier(req.headers['x-request-id']);
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
          policyDigest: sha256(JSON.stringify(config.policy)),
          authorizationRecordId: config.authorizationRecordId,
          authorizingHuman: config.founderName,
          aiExecutionPartner: config.aiPartnerName
        });
      }

      if (req.method === 'GET' && req.url === '/v1/verification') {
        return json(res, 200, config.verification);
      }

      if (req.method === 'POST' && req.url === '/webhooks/github') {
        const event = headerString(req.headers['x-github-event']).trim();
        const deliveryId = headerString(req.headers['x-github-delivery']).trim();
        if (!event || !deliveryId) {
          return json(res, 400, { error: 'missing_github_delivery_headers', requestId });
        }

        const rateLimit = webhookRateLimiter.consume(remoteAddress);
        const rateHeaders = {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining)
        };
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
            { ...rateHeaders, 'Retry-After': String(rateLimit.retryAfterSeconds) }
          );
        }

        const rawBody = await readBody(req, config.maxBodyBytes);
        const signatureHeader = headerString(req.headers['x-hub-signature-256']);
        if (!verifyGitHubSignature({
          secret: config.webhookSecret,
          signatureHeader,
          rawBody
        })) {
          logger.warn('Webhook signature rejected', { requestId, remoteAddress, event, deliveryId });
          return json(res, 401, { error: 'invalid_webhook_signature', requestId }, rateHeaders);
        }

        let payload;
        try {
          payload = JSON.parse(rawBody.toString('utf8'));
        } catch {
          return json(res, 400, { error: 'invalid_json', requestId }, rateHeaders);
        }

        const result = await processor.process({ event, deliveryId, payload });
        return json(res, 202, { requestId, ...result }, rateHeaders);
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
