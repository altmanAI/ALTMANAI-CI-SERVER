import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGitHubSignature, sha256 } from '../src/crypto.mjs';

test('validates GitHub documented HMAC-SHA256 vector', () => {
  const rawBody = Buffer.from('Hello, World!', 'utf8');
  const signatureHeader = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
  assert.equal(verifyGitHubSignature({
    secret: "It's a Secret to Everybody",
    signatureHeader,
    rawBody
  }), true);
});

test('rejects invalid signatures', () => {
  assert.equal(verifyGitHubSignature({
    secret: 'secret',
    signatureHeader: 'sha256=deadbeef',
    rawBody: Buffer.from('{}')
  }), false);
});

test('sha256 is deterministic', () => {
  assert.equal(sha256('altmanai'), sha256('altmanai'));
});
