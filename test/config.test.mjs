import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';

const paths = {
  POLICY_PATH: './config/policy.json',
  VERIFICATION_PATH: './config/verification.json'
};

test('loads verified development configuration', async () => {
  const config = await loadConfig({ NODE_ENV: 'development', ...paths });
  assert.equal(config.production, false);
  assert.equal(config.policy.checkName, 'AltmanAI Governance Gate');
  assert.equal(config.founderName, 'Blake Hunter Altman');
  assert.equal(config.founderGitHubLogin, 'altmanAI');
  assert.equal(config.founderGitHubUserId, 233472124);
  assert.equal(config.aiPartnerName, 'AltmanAI Model 2.0');
  assert.equal(config.authorizationRecordId, 'ALTMANAI-CI-VERIFY-2026-07-13-001');
});

test('requires production webhook and GitHub App credentials', async () => {
  await assert.rejects(
    loadConfig({ NODE_ENV: 'production', ...paths }),
    /WEBHOOK_SECRET is required/
  );

  await assert.rejects(
    loadConfig({
      NODE_ENV: 'production',
      ...paths,
      WEBHOOK_SECRET: 'secret',
      ALLOWED_GITHUB_OWNER: 'altmanAI'
    }),
    /Production requires GITHUB_APP_ID \+ GITHUB_PRIVATE_KEY/
  );
});

test('static production token requires explicit opt-in', async () => {
  const base = {
    NODE_ENV: 'production',
    ...paths,
    WEBHOOK_SECRET: 'secret',
    ALLOWED_GITHUB_OWNER: 'altmanAI',
    GITHUB_TOKEN: 'development-token'
  };
  await assert.rejects(loadConfig(base), /explicit ALLOW_STATIC_GITHUB_TOKEN=true/);
  const config = await loadConfig({ ...base, ALLOW_STATIC_GITHUB_TOKEN: 'true' });
  assert.equal(config.allowStaticGitHubToken, true);
});

test('rejects malformed policy before server startup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-config-'));
  const badPolicy = join(dir, 'policy.json');
  await writeFile(badPolicy, JSON.stringify({ policyVersion: 'bad' }));
  await assert.rejects(
    loadConfig({ NODE_ENV: 'development', POLICY_PATH: badPolicy, VERIFICATION_PATH: paths.VERIFICATION_PATH }),
    /policy.checkName/
  );
});

test('rejects a verification record with a mismatched statement digest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-verification-'));
  const badVerification = join(dir, 'verification.json');
  const verification = JSON.parse(await (await import('node:fs/promises')).readFile(paths.VERIFICATION_PATH, 'utf8'));
  verification.statement = `${verification.statement} changed`;
  await writeFile(badVerification, JSON.stringify(verification));
  await assert.rejects(
    loadConfig({ NODE_ENV: 'development', POLICY_PATH: paths.POLICY_PATH, VERIFICATION_PATH: badVerification }),
    /does not match/
  );
});
