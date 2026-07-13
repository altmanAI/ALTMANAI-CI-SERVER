import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePullRequest, globToRegex } from '../src/policy-engine.mjs';
import policy from '../config/policy.json' with { type: 'json' };

const completeBody = `
## What changed
Added a safe feature.
## Validation
Tests pass.
## Risk and rollback
Revert the commit.
## AI assistance
AltmanAI Model 2.0 assisted; Blake authorized the final change.
## Founder authorization
Recorded through a standalone PR comment.
`;

test('glob matching supports recursive and single-segment wildcards', () => {
  assert.equal(globToRegex('src/**').test('src/server.mjs'), true);
  assert.equal(globToRegex('**/*.pem').test('secrets/app.pem'), true);
  assert.equal(globToRegex('**/*.pem').test('app.pem'), true);
  assert.equal(globToRegex('.env.*').test('.env.production'), true);
});

test('passes material change with exact founder approval', () => {
  const result = evaluatePullRequest({
    policy,
    pullRequest: { body: completeBody },
    files: [{ filename: 'src/server.mjs' }],
    comments: [{ user: { login: 'BlakeAltman' }, body: 'All Clear for Impact' }],
    founderLogin: 'BlakeAltman',
    approvalPhrase: 'All Clear for Impact'
  });
  assert.equal(result.conclusion, 'success');
  assert.equal(result.metadata.founderApproved, true);
});

test('rejects approval from another identity or non-standalone phrase', () => {
  const result = evaluatePullRequest({
    policy,
    pullRequest: { body: completeBody },
    files: [{ filename: 'src/server.mjs' }],
    comments: [
      { user: { login: 'someone-else' }, body: 'All Clear for Impact' },
      { user: { login: 'BlakeAltman' }, body: 'Approved: All Clear for Impact' }
    ],
    founderLogin: 'BlakeAltman',
    approvalPhrase: 'All Clear for Impact'
  });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.code === 'founder_approval_missing'));
});

test('blocks credential-like files', () => {
  const result = evaluatePullRequest({
    policy,
    pullRequest: { body: completeBody },
    files: [{ filename: '.env.production' }],
    comments: [{ user: { login: 'BlakeAltman' }, body: 'All Clear for Impact' }],
    founderLogin: 'BlakeAltman',
    approvalPhrase: 'All Clear for Impact'
  });
  assert.equal(result.conclusion, 'failure');
  assert.ok(result.findings.some((item) => item.code === 'forbidden_path'));
});
