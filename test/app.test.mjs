import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app.mjs';
import { createLogger } from '../src/logger.mjs';

function testConfig() {
  return {
    serviceName: 'altmanai-ci-server',
    serviceVersion: '0.2.0',
    nodeEnv: 'test',
    policy: { policyVersion: 'test' },
    maxBodyBytes: 1024,
    webhookSecret: 'secret',
    authorizationRecordId: 'VERIFY-1',
    founderName: 'Blake Hunter Altman',
    aiPartnerName: 'AltmanAI Model 2.0',
    verification: { record_id: 'VERIFY-1', statement_sha256: 'a'.repeat(64) }
  };
}

async function startServer(t, processor = { process: async () => ({ accepted: true }) }) {
  const server = createApp({
    config: testConfig(),
    processor,
    ledger: { verify: async () => ({ valid: true, records: 0 }) },
    logger: createLogger({ level: 'error' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return server.address().port;
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
  const signature = `sha256=${createHmac('sha256', 'secret').update(raw).digest('hex')}`;
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'ping',
      'x-github-delivery': 'delivery-2',
      'x-hub-signature-256': signature
    },
    body: raw
  });
  assert.equal(response.status, 202);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].deliveryId, 'delivery-2');
});
