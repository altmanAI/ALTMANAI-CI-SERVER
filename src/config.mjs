import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from './crypto.mjs';

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const VALID_APPROVAL_MODES = new Set(['all_changes', 'material_changes', 'disabled']);

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function optionalPositiveInteger(value, name) {
  if (value === undefined || value === '') return null;
  return positiveInteger(value, undefined, name);
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

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
}

function assertStringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} must be a non-empty array of strings`);
  }
}

export function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('Policy must be a JSON object');
  assertString(policy.policyVersion, 'policy.policyVersion');
  assertString(policy.checkName, 'policy.checkName');
  if (!VALID_APPROVAL_MODES.has(policy.approvalMode)) {
    throw new Error(`policy.approvalMode must be one of: ${[...VALID_APPROVAL_MODES].join(', ')}`);
  }
  positiveInteger(policy.materialChangeFileThreshold, undefined, 'policy.materialChangeFileThreshold');
  positiveInteger(policy.maxChangedFiles, undefined, 'policy.maxChangedFiles');
  if (typeof policy.requireAiDisclosure !== 'boolean') throw new Error('policy.requireAiDisclosure must be boolean');
  assertStringArray(policy.aiDisclosureMarkers, 'policy.aiDisclosureMarkers');
  assertStringArray(policy.requiredPrSections, 'policy.requiredPrSections');
  assertStringArray(policy.protectedPathGlobs, 'policy.protectedPathGlobs');
  assertStringArray(policy.forbiddenPathGlobs, 'policy.forbiddenPathGlobs');
  return policy;
}

export function validateVerification(verification) {
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    throw new Error('Verification record must be a JSON object');
  }
  assertString(verification.record_id, 'verification.record_id');
  assertString(verification.verified_at, 'verification.verified_at');
  assertString(verification.statement, 'verification.statement');
  if (!/^[a-f0-9]{64}$/.test(verification.statement_sha256 || '')) {
    throw new Error('verification.statement_sha256 must be a lowercase SHA-256 digest');
  }
  if (sha256(verification.statement) !== verification.statement_sha256) {
    throw new Error('verification.statement_sha256 does not match verification.statement');
  }
  assertString(verification.authorizing_human?.name, 'verification.authorizing_human.name');
  assertString(verification.authorizing_human?.github_login, 'verification.authorizing_human.github_login');
  positiveInteger(verification.authorizing_human?.github_user_id, undefined, 'verification.authorizing_human.github_user_id');
  assertString(verification.ai_execution_partner?.name, 'verification.ai_execution_partner.name');
  return verification;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

async function readJson(path, name) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${name} could not be read at ${path}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

export async function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'production';
  const production = nodeEnv === 'production';
  const logLevel = env.LOG_LEVEL || 'info';
  if (!VALID_LOG_LEVELS.has(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${[...VALID_LOG_LEVELS].join(', ')}`);
  }

  const policyPath = resolve(env.POLICY_PATH || './config/policy.json');
  const verificationPath = resolve(env.VERIFICATION_PATH || './config/verification.json');
  const policy = validatePolicy(await readJson(policyPath, 'Policy'));
  const verification = validateVerification(await readJson(verificationPath, 'Verification record'));

  const config = {
    nodeEnv,
    production,
    host: env.HOST || '0.0.0.0',
    port: positiveInteger(env.PORT, 8080, 'PORT'),
    logLevel,
    maxBodyBytes: positiveInteger(env.MAX_BODY_BYTES, 1_048_576, 'MAX_BODY_BYTES'),
    webhookRateLimitMax: positiveInteger(env.WEBHOOK_RATE_LIMIT_MAX, 120, 'WEBHOOK_RATE_LIMIT_MAX'),
    webhookRateLimitWindowMs: positiveInteger(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000, 'WEBHOOK_RATE_LIMIT_WINDOW_MS'),
    trustProxyHeaders: booleanValue(env.TRUST_PROXY_HEADERS, false, 'TRUST_PROXY_HEADERS'),
    webhookSecret: env.WEBHOOK_SECRET || '',
    founderName: env.FOUNDER_NAME || verification.authorizing_human.name,
    founderGitHubLogin: env.FOUNDER_GITHUB_LOGIN || verification.authorizing_human.github_login,
    founderGitHubUserId: optionalPositiveInteger(
      env.FOUNDER_GITHUB_USER_ID || verification.authorizing_human.github_user_id,
      'FOUNDER_GITHUB_USER_ID'
    ),
    founderApprovalPhrase: env.FOUNDER_APPROVAL_PHRASE || 'All Clear for Impact',
    aiPartnerName: env.AI_PARTNER_NAME || verification.ai_execution_partner.name,
    authorizationRecordId: env.AUTHORIZATION_RECORD_ID || verification.record_id,
    allowedGitHubOwner: env.ALLOWED_GITHUB_OWNER || '',
    githubAppId: env.GITHUB_APP_ID || '',
    githubPrivateKey: (env.GITHUB_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    githubToken: env.GITHUB_TOKEN || '',
    allowStaticGitHubToken: booleanValue(env.ALLOW_STATIC_GITHUB_TOKEN, false, 'ALLOW_STATIC_GITHUB_TOKEN'),
    githubApiUrl: (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
    githubApiVersion: env.GITHUB_API_VERSION || '2026-03-10',
    githubRequestTimeoutMs: positiveInteger(env.GITHUB_REQUEST_TIMEOUT_MS, 10_000, 'GITHUB_REQUEST_TIMEOUT_MS'),
    policyPath,
    policy: deepFreeze(policy),
    verificationPath,
    verification: deepFreeze(verification),
    evidenceLedgerPath: resolve(env.EVIDENCE_LEDGER_PATH || './data/evidence.ndjson'),
    serviceName: env.SERVICE_NAME || 'altmanai-ci-server',
    serviceVersion: env.SERVICE_VERSION || '0.2.0'
  };

  if (config.port > 65_535) throw new Error('PORT must be between 1 and 65535');
  if (config.webhookRateLimitWindowMs > 3_600_000) {
    throw new Error('WEBHOOK_RATE_LIMIT_WINDOW_MS must not exceed 3600000');
  }

  if (production) {
    required(config.webhookSecret, 'WEBHOOK_SECRET');
    required(config.founderName, 'FOUNDER_NAME');
    required(config.founderGitHubLogin, 'FOUNDER_GITHUB_LOGIN');
    positiveInteger(config.founderGitHubUserId, undefined, 'FOUNDER_GITHUB_USER_ID');
    required(config.allowedGitHubOwner, 'ALLOWED_GITHUB_OWNER');
    if (!(config.githubAppId && config.githubPrivateKey)) {
      if (!(config.allowStaticGitHubToken && config.githubToken)) {
        throw new Error('Production requires GITHUB_APP_ID + GITHUB_PRIVATE_KEY; static GITHUB_TOKEN requires explicit ALLOW_STATIC_GITHUB_TOKEN=true');
      }
    }
  }

  return deepFreeze(config);
}
