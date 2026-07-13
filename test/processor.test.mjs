import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
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
    founderName: 'Blake Hunter Altman',
    founderGitHubLogin: 'altmanAI',
    founderGitHubUserId: 233472124,
    founderApprovalPhrase: 'All Clear for Impact',
    aiPartnerName: 'AltmanAI Model 2.0',
    authorizationRecordId: 'ALTMANAI-CI-VERIFY-2026-07-13-001',
    policy
  };
}

function githubMock(calls) {
  return {
    getToken: async () => 'token',
    getPullRequest: async (_owner, _repo, number) => ({
      number,
      body: completeBody,
      head: { sha: 'abc123' }
    }),
    getPullRequestFiles: async () => [{ filename: 'src/server.mjs', status: 'modified' }],
    getIssueComments: async () => [{
      user: { login: 'altmanAI', id: 233472124 },
      body: 'All Clear for Impact'
    }],
    createCheckRun: async (...args) => {
      calls.push(args);
      return { id: 123, html_url: 'https://github.example/check/123' };
    }
  };
}

test('processes a pull request, publishes a check, and records identity-bound evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-processor-'));
  const ledgerPath = join(dir, 'evidence.ndjson');
  const ledger = new EvidenceLedger(ledgerPath);
  await ledger.initialize();
  const calls = [];
  const processor = new WebhookProcessor({
    config: config(),
    github: githubMock(calls),
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
  assert.equal(result.authorizationRecordId, 'ALTMANAI-CI-VERIFY-2026-07-13-001');
  assert.equal(calls.length, 1);
  assert.equal((await ledger.verify()).records, 1);
  const evidence = JSON.parse((await readFile(ledgerPath, 'utf8')).trim());
  assert.equal(evidence.authorizing_human, 'Blake Hunter Altman');
  assert.equal(evidence.authorizing_github_user_id, 233472124);
  assert.equal(evidence.ai_execution_partner, 'AltmanAI Model 2.0');
});

test('re-evaluates pull requests when founder comments are created, edited, or deleted', async () => {
  for (const action of ['created', 'edited', 'deleted']) {
    const dir = await mkdtemp(join(tmpdir(), 'altmanai-comment-'));
    const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
    await ledger.initialize();
    const calls = [];
    const processor = new WebhookProcessor({
      config: config(),
      github: githubMock(calls),
      ledger,
      logger: createLogger({ level: 'error' })
    });
    const result = await processor.process({
      event: 'issue_comment',
      deliveryId: `delivery-${action}`,
      payload: {
        action,
        installation: { id: 1 },
        repository: { full_name: 'altmanAI/example' },
        issue: { number: 7, pull_request: { url: 'https://api.github.com/example' } }
      }
    });
    assert.equal(result.conclusion, 'success');
    assert.equal(calls.length, 1);
  }
});

test('ignores unrelated issue comment actions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-comment-ignore-'));
  const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
  await ledger.initialize();
  const processor = new WebhookProcessor({
    config: config(),
    github: githubMock([]),
    ledger,
    logger: createLogger({ level: 'error' })
  });
  const result = await processor.process({
    event: 'issue_comment',
    deliveryId: 'delivery-labeled',
    payload: {
      action: 'labeled',
      repository: { full_name: 'altmanAI/example' },
      issue: { number: 7, pull_request: {} }
    }
  });
  assert.equal(result.ignored, true);
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

test('rejects a pull request without a head SHA before publishing a check', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-head-'));
  const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
  await ledger.initialize();
  const processor = new WebhookProcessor({
    config: config(),
    github: githubMock([]),
    ledger,
    logger: createLogger({ level: 'error' })
  });
  await assert.rejects(
    processor.process({
      event: 'pull_request',
      deliveryId: 'delivery-no-head',
      payload: {
        action: 'opened',
        repository: { full_name: 'altmanAI/example' },
        pull_request: { number: 7, body: completeBody, head: {} }
      }
    }),
    /head SHA is missing/
  );
});
