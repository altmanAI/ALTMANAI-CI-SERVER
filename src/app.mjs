import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { verifyGitHubSignature, sha256 } from './crypto.mjs';

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
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

export function createApp({ config, processor, ledger, logger, startedAt = Date.now() }) {
  return createHttpServer(async (req, res) => {
    const requestId = String(req.headers['x-request-id'] || randomUUID());
    const started = Date.now();
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
        const rawBody = await readBody(req, config.maxBodyBytes);
        const signatureHeader = req.headers['x-hub-signature-256'];
        if (!verifyGitHubSignature({
          secret: config.webhookSecret,
          signatureHeader,
          rawBody
        })) {
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
        durationMs: Date.now() - started
      });
    }
  });
}
