import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { createLogger } from '../src/logger.mjs';

function testConfig(overrides = {}) {
  return {
    serviceName: 'altmanai-ci-server',
    serviceVersion: '0.1.0',
    nodeEnv: 'test',
    policy: { policyVersion: 'test' },
    maxBodyBytes: 1024,
    webhookRateLimitWindowMs: 60_000,
    webhookRateLimitMax: 120,
    trustProxyHeaders: false,
    webhookSecret: 'secret',
    ...overrides
  };
}

async function startServer(t, config = testConfig()) {
  const server = createApp({
    config,
    processor: { process: async () => ({ accepted: true }) },
    ledger: { verify: async () => ({ valid: true, records: 0 }) },
    logger: createLogger({ level: 'error' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return server.address().port;
}

test('health route reports service status', async (t) => {
  const port = await startServer(t);
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('webhook route rejects invalid signatures', async (t) => {
  const port = await startServer(t);
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=invalid' },
    body: '{}'
  });
  assert.equal(response.status, 401);
});

test('webhook route rate limits repeated requests by client address', async (t) => {
  const port = await startServer(t, testConfig({
    webhookRateLimitMax: 1,
    trustProxyHeaders: true
  }));
  const request = () => fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: {
      'x-hub-signature-256': 'sha256=invalid',
      'fly-client-ip': '203.0.113.10'
    },
    body: '{}'
  });

  assert.equal((await request()).status, 401);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal((await limited.json()).error, 'rate_limit_exceeded');
});
