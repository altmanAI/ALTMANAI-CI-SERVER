import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.mjs';

test('loads development configuration without production secrets', async () => {
  const config = await loadConfig({
    NODE_ENV: 'development',
    POLICY_PATH: './config/policy.json'
  });
  assert.equal(config.production, false);
  assert.equal(config.policy.checkName, 'AltmanAI Governance Gate');
});

test('requires production credentials', async () => {
  await assert.rejects(
    loadConfig({ NODE_ENV: 'production', POLICY_PATH: './config/policy.json' }),
    /WEBHOOK_SECRET is required/
  );
});
