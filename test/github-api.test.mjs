import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubApi } from '../src/github-api.mjs';

function response(status, body, headers = { 'content-type': 'application/json' }) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

function config(overrides = {}) {
  return {
    githubApiUrl: 'https://api.github.test',
    githubApiVersion: '2026-03-10',
    githubRequestTimeoutMs: 1000,
    serviceName: 'altmanai-ci-server',
    githubToken: 'static-token',
    githubAppId: '',
    githubPrivateKey: '',
    ...overrides
  };
}

test('returns JSON data from successful API responses', async () => {
  const calls = [];
  const api = new GitHubApi(config(), async (url, options) => {
    calls.push({ url, options });
    return response(200, { ok: true });
  });
  assert.deepEqual(await api.request('/zen', { token: 'token' }), { ok: true });
  assert.equal(calls[0].options.headers['X-GitHub-Api-Version'], '2026-03-10');
});

test('preserves a non-JSON GitHub error without crashing the parser', async () => {
  const api = new GitHubApi(config(), async () => response(502, 'upstream failure', { 'content-type': 'text/plain' }));
  await assert.rejects(
    api.request('/broken', { token: 'token', attempts: 1 }),
    (error) => error.status === 502 && error.response.message === 'upstream failure'
  );
});

test('requires an authentication token for every request', async () => {
  const api = new GitHubApi(config(), async () => response(200, {}));
  await assert.rejects(api.request('/zen'), /requires an authentication token/);
});

test('retries transient GitHub failures and returns the successful response', async () => {
  let attempts = 0;
  const api = new GitHubApi(config(), async () => {
    attempts += 1;
    return attempts === 1 ? response(503, { message: 'retry' }) : response(200, { ok: true });
  });
  assert.deepEqual(await api.request('/retry', { token: 'token' }), { ok: true });
  assert.equal(attempts, 2);
});

test('uses a configured static development token without network exchange', async () => {
  const api = new GitHubApi(config(), async () => {
    throw new Error('network should not be called');
  });
  assert.equal(await api.getToken(1), 'static-token');
});

test('fails closed when pagination exceeds the evidence cap', async () => {
  const api = new GitHubApi(config(), async () => response(200, Array.from({ length: 100 }, (_, id) => ({ id }))));
  await assert.rejects(api.paginate('/items', 'token'), /pagination limit exceeded/);
});
