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
  assert.equal(config.webhookRateLimitMax, 120);
  assert.equal(config.webhookRateLimitWindowMs, 60_000);
  assert.equal(config.trustProxyHeaders, false);
});

test('parses production hardening settings', async () => {
  const config = await loadConfig({
    NODE_ENV: 'development',
    POLICY_PATH: './config/policy.json',
    WEBHOOK_RATE_LIMIT_MAX: '25',
    WEBHOOK_RATE_LIMIT_WINDOW_MS: '5000',
    TRUST_PROXY_HEADERS: 'true',
    LEDGER_BACKUP_RETENTION_DAYS: '14',
    WEBHOOK_SECRET_PREVIOUS: 'old-secret'
  });
  assert.equal(config.webhookRateLimitMax, 25);
  assert.equal(config.webhookRateLimitWindowMs, 5000);
  assert.equal(config.trustProxyHeaders, true);
  assert.equal(config.ledgerBackupRetentionDays, 14);
  assert.equal(config.webhookSecretPrevious, 'old-secret');
});

test('rejects invalid proxy configuration', async () => {
  await assert.rejects(
    loadConfig({
      NODE_ENV: 'development',
      POLICY_PATH: './config/policy.json',
      TRUST_PROXY_HEADERS: 'sometimes'
    }),
    /TRUST_PROXY_HEADERS must be true or false/
  );
});

test('requires production credentials', async () => {
  await assert.rejects(
    loadConfig({ NODE_ENV: 'production', POLICY_PATH: './config/policy.json' }),
    /WEBHOOK_SECRET is required/
  );
});
