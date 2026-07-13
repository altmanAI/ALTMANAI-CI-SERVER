import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import policy from '../config/policy.json' with { type: 'json' };
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { WebhookProcessor } from '../src/processor.mjs';
import { createLogger } from '../src/logger.mjs';

const completeBody = `
## What changed
Change.
## Validation
Validated.
## Risk and rollback
Revert.
## AI assistance
AltmanAI Model 2.0 assisted; human authority retained.
## Founder authorization
Standalone comment.
`;

function config() {
  return {
    allowedGitHubOwner: 'altmanAI',
    founderGitHubLogin: 'BlakeAltman',
    founderApprovalPhrase: 'All Clear for Impact',
    policy
  };
}

test('processes a pull request, publishes a check, and records evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-processor-'));
  const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
  await ledger.initialize();
  const calls = [];
  const github = {
    getToken: async () => 'token',
    getPullRequestFiles: async () => [{ filename: 'src/server.mjs', status: 'modified' }],
    getIssueComments: async () => [{ user: { login: 'BlakeAltman' }, body: 'All Clear for Impact' }],
    createCheckRun: async (...args) => {
      calls.push(args);
      return { id: 123, html_url: 'https://github.example/check/123' };
    }
  };
  const processor = new WebhookProcessor({
    config: config(),
    github,
    ledger,
    logger: createLogger({ level: 'error' })
  });

  const result = await processor.process({
    event: 'pull_request',
    deliveryId: 'delivery-123',
    payload: {
      action: 'opened',
      installation: { id: 1 },
      repository: { full_name: 'altmanAI/example' },
      pull_request: {
        number: 7,
        body: completeBody,
        head: { sha: 'abc123' }
      }
    }
  });

  assert.equal(result.conclusion, 'success');
  assert.equal(calls.length, 1);
  assert.equal((await ledger.verify()).records, 1);
});

test('rejects repositories outside the configured owner', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-processor-'));
  const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
  await ledger.initialize();
  const processor = new WebhookProcessor({
    config: config(),
    github: {},
    ledger,
    logger: createLogger({ level: 'error' })
  });

  await assert.rejects(
    processor.process({
      event: 'ping',
      deliveryId: 'delivery-x',
      payload: { repository: { full_name: 'another-org/example' } }
    }),
    /Repository owner is not allowed/
  );
});
