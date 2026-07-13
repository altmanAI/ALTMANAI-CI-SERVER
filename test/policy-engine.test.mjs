import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePullRequest, globToRegex } from '../src/policy-engine.mjs';
import policy from '../config/policy.json' with { type: 'json' };

const founder = { login: 'altmanAI', id: 233472124 };
const completeBody = `
## What changed
Added a safe feature.
## Validation
Tests pass.
## Risk and rollback
Revert the commit.
## AI assistance
AltmanAI Model 2.0 assisted; Blake Hunter Altman retained final authority.
## Founder authorization
Recorded through a standalone PR comment.
`;

function evaluate({ body = completeBody, files = [{ filename: 'src/server.mjs' }], comments = [] } = {}) {
  return evaluatePullRequest({
    policy,
    pullRequest: { body },
    files,
    comments,
    founderLogin: founder.login,
    founderUserId: founder.id,
    approvalPhrase: 'All Clear for Impact'
  });
}

test('glob matching supports recursive and single-segment wildcards', () => {
  assert.equal(globToRegex('src/**').test('src/server.mjs'), true);
  assert.equal(globToRegex('**/*.pem').test('secrets/app.pem'), true);
  assert.equal(globToRegex('**/*.pem').test('app.pem'), true);
  assert.equal(globToRegex('.env.*').test('.env.production'), true);
});

test('passes material change with exact founder login, immutable ID, and phrase', () => {
  const result = evaluate({ comments: [{ user: founder, body: 'All Clear for Impact' }] });
  assert.equal(result.conclusion, 'success');
  assert.equal(result.metadata.founderApproved, true);
});

test('rejects correct login with the wrong immutable GitHub user ID', () => {
  const result = evaluate({
    comments: [{ user: { login: founder.login, id: 999 }, body: 'All Clear for Impact' }]
  });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.code === 'founder_approval_missing'));
});

test('rejects approval from another identity or non-standalone phrase', () => {
  const result = evaluate({
    comments: [
      { user: { login: 'someone-else', id: founder.id }, body: 'All Clear for Impact' },
      { user: founder, body: 'Approved: All Clear for Impact' }
    ]
  });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.code === 'founder_approval_missing'));
});

test('requires actual markdown heading lines instead of phrases embedded in prose', () => {
  const body = completeBody.replace('## Validation', 'The PR mentions ## Validation inside a sentence.');
  const result = evaluate({ body, comments: [{ user: founder, body: 'All Clear for Impact' }] });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.message.includes('## Validation')));
});

test('AI disclosure markers are matched case-insensitively', () => {
  const body = completeBody.replace('AltmanAI Model 2.0', 'ALTMANAI MODEL 2.0');
  const result = evaluate({ body, comments: [{ user: founder, body: 'All Clear for Impact' }] });
  assert.equal(result.conclusion, 'success');
});

test('blocks credential-like files', () => {
  const result = evaluate({
    files: [{ filename: '.env.production' }],
    comments: [{ user: founder, body: 'All Clear for Impact' }]
  });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.code === 'forbidden_path'));
});

test('handles malformed file and comment arrays without throwing', () => {
  const result = evaluatePullRequest({
    policy,
    pullRequest: { body: completeBody },
    files: null,
    comments: null,
    founderLogin: founder.login,
    founderUserId: founder.id,
    approvalPhrase: 'All Clear for Impact'
  });
  assert.equal(result.conclusion, 'success');
  assert.equal(result.metadata.fileCount, 0);
});
