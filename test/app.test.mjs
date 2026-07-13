import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app.mjs';
import { createLogger } from '../src/logger.mjs';

function testConfig(overrides = {}) {
  return {
    serviceName: 'altmanai-ci-server',
    serviceVersion: '0.2.0',
    nodeEnv: 'test',
    policy: { policyVersion: 'test' },
    maxBodyBytes: 1024,
    webhookRateLimitMax: 120,
    webhookRateLimitWindowMs: 60_000,
    trustProxyHeaders: false,
    webhookSecret: 'secret',
    authorizationRecordId: 'VERIFY-1',
    founderName: 'Blake Hunter Altman',
    aiPartnerName: 'AltmanAI Model 2.0',
    verification: { record_id: 'VERIFY-1', statement_sha256: 'a'.repeat(64) },
    ...overrides
  };
}

async function startServer(
  t,
  processor = { process: async () => ({ accepted: true }) },
  config = testConfig()
) {
  const server = createApp({
    config,
    processor,
    ledger: { verify: async () => ({ valid: true, records: 0 }) },
    logger: createLogger({ level: 'error' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return server.address().port;
}

function signedHeaders(raw, deliveryId) {
  return {
    'content-type': 'application/json',
    'x-github-event': 'ping',
    'x-github-delivery': deliveryId,
    'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret').update(raw).digest('hex')}`
  };
}

test('health and status routes report verified service identity', async (t) => {
  const port = await startServer(t);
  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).version, '0.2.0');

  const status = await fetch(`http://127.0.0.1:${port}/v1/status`);
  const body = await status.json();
  assert.equal(body.authorizingHuman, 'Blake Hunter Altman');
  assert.equal(body.aiExecutionPartner, 'AltmanAI Model 2.0');
  assert.equal(body.authorizationRecordId, 'VERIFY-1');
});

test('verification route returns repository-backed proof', async (t) => {
  const port = await startServer(t);
  const response = await fetch(`http://127.0.0.1:${port}/v1/verification`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).record_id, 'VERIFY-1');
});

test('webhook route requires GitHub event and delivery headers', async (t) => {
  const port = await startServer(t);
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    body: '{}'
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'missing_github_delivery_headers');
});

test('webhook route rejects invalid signatures', async (t) => {
  const port = await startServer(t);
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: {
      'x-github-event': 'ping',
      'x-github-delivery': 'delivery-1',
      'x-hub-signature-256': `sha256=${'0'.repeat(64)}`
    },
    body: '{}'
  });
  assert.equal(response.status, 401);
});

test('webhook route accepts a correctly signed delivery', async (t) => {
  const calls = [];
  const port = await startServer(t, {
    process: async (input) => {
      calls.push(input);
      return { accepted: true, event: input.event };
    }
  });
  const raw = JSON.stringify({ zen: 'Humanity leads.' });
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: signedHeaders(raw, 'delivery-2'),
    body: raw
  });
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('x-ratelimit-limit'), '120');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].deliveryId, 'delivery-2');
});

test('webhook route limits abusive request bursts before processing', async (t) => {
  const raw = JSON.stringify({ zen: 'Rate limit test.' });
  const port = await startServer(
    t,
    { process: async () => ({ accepted: true }) },
    testConfig({ webhookRateLimitMax: 2 })
  );

  for (const deliveryId of ['rate-1', 'rate-2']) {
    const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
      method: 'POST',
      headers: signedHeaders(raw, deliveryId),
      body: raw
    });
    assert.equal(response.status, 202);
  }

  const limited = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: signedHeaders(raw, 'rate-3'),
    body: raw
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('x-ratelimit-remaining'), '0');
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal((await limited.json()).error, 'rate_limit_exceeded');
});

test('trusted Fly client address is accepted only when explicitly enabled', async (t) => {
  const raw = JSON.stringify({ zen: 'Proxy test.' });
  const port = await startServer(
    t,
    { process: async () => ({ accepted: true }) },
    testConfig({ webhookRateLimitMax: 1, trustProxyHeaders: true })
  );

  for (const [index, clientIp] of ['203.0.113.10', '203.0.113.11'].entries()) {
    const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
      method: 'POST',
      headers: { ...signedHeaders(raw, `proxy-${index}`), 'fly-client-ip': clientIp },
      body: raw
    });
    assert.equal(response.status, 202);
  }
});
