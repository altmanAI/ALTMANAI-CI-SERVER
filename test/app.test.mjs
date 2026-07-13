import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { createLogger } from '../src/logger.mjs';

function testConfig() {
  return {
    serviceName: 'altmanai-ci-server',
    serviceVersion: '0.1.0',
    nodeEnv: 'test',
    policy: { policyVersion: 'test' },
    maxBodyBytes: 1024,
    webhookSecret: 'secret'
  };
}

test('health route reports service status', async (t) => {
  const server = createApp({
    config: testConfig(),
    processor: { process: async () => ({ accepted: true }) },
    ledger: { verify: async () => ({ valid: true, records: 0 }) },
    logger: createLogger({ level: 'error' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('webhook route rejects invalid signatures', async (t) => {
  const server = createApp({
    config: testConfig(),
    processor: { process: async () => ({ accepted: true }) },
    ledger: { verify: async () => ({ valid: true, records: 0 }) },
    logger: createLogger({ level: 'error' })
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/webhooks/github`, {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=invalid' },
    body: '{}'
  });
  assert.equal(response.status, 401);
});
