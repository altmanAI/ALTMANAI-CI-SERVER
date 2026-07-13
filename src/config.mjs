import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function booleanValue(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function required(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  return String(value).trim();
}

export async function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'production';
  const production = nodeEnv === 'production';
  const logLevel = env.LOG_LEVEL || 'info';
  if (!VALID_LOG_LEVELS.has(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${[...VALID_LOG_LEVELS].join(', ')}`);
  }

  const policyPath = resolve(env.POLICY_PATH || './config/policy.json');
  const rawPolicy = await readFile(policyPath, 'utf8');
  const policy = JSON.parse(rawPolicy);

  const config = {
    nodeEnv,
    production,
    host: env.HOST || '0.0.0.0',
    port: positiveInteger(env.PORT, 8080, 'PORT'),
    logLevel,
    maxBodyBytes: positiveInteger(env.MAX_BODY_BYTES, 1_048_576, 'MAX_BODY_BYTES'),
    webhookRateLimitWindowMs: positiveInteger(
      env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
      60_000,
      'WEBHOOK_RATE_LIMIT_WINDOW_MS'
    ),
    webhookRateLimitMax: positiveInteger(
      env.WEBHOOK_RATE_LIMIT_MAX,
      120,
      'WEBHOOK_RATE_LIMIT_MAX'
    ),
    trustProxyHeaders: booleanValue(env.TRUST_PROXY_HEADERS, false, 'TRUST_PROXY_HEADERS'),
    webhookSecret: env.WEBHOOK_SECRET || '',
    founderGitHubLogin: env.FOUNDER_GITHUB_LOGIN || '',
    founderApprovalPhrase: env.FOUNDER_APPROVAL_PHRASE || 'All Clear for Impact',
    allowedGitHubOwner: env.ALLOWED_GITHUB_OWNER || '',
    githubAppId: env.GITHUB_APP_ID || '',
    githubPrivateKey: (env.GITHUB_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    githubToken: env.GITHUB_TOKEN || '',
    githubApiUrl: (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
    githubApiVersion: env.GITHUB_API_VERSION || '2026-03-10',
    policyPath,
    policy,
    evidenceLedgerPath: resolve(env.EVIDENCE_LEDGER_PATH || './data/evidence.ndjson'),
    evidenceBackupDir: resolve(env.EVIDENCE_BACKUP_DIR || './data/backups'),
    ledgerBackupRetentionDays: positiveInteger(
      env.LEDGER_BACKUP_RETENTION_DAYS,
      30,
      'LEDGER_BACKUP_RETENTION_DAYS'
    ),
    serviceName: env.SERVICE_NAME || 'altmanai-ci-server',
    serviceVersion: env.SERVICE_VERSION || '0.1.0'
  };

  if (production) {
    required(config.webhookSecret, 'WEBHOOK_SECRET');
    required(config.founderGitHubLogin, 'FOUNDER_GITHUB_LOGIN');
    required(config.allowedGitHubOwner, 'ALLOWED_GITHUB_OWNER');
    if (!config.githubToken && !(config.githubAppId && config.githubPrivateKey)) {
      throw new Error('Production requires GITHUB_APP_ID + GITHUB_PRIVATE_KEY or GITHUB_TOKEN');
    }
  }

  return Object.freeze(config);
}
