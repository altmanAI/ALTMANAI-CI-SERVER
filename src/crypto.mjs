import { createHmac, createHash, timingSafeEqual, sign as rsaSign } from 'node:crypto';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function verifyGitHubSignature({ secret, signatureHeader, rawBody }) {
  if (!secret || typeof signatureHeader !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signatureHeader)) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export function createGitHubAppJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  if (!appId || !privateKey) {
    throw new Error('GitHub App ID and private key are required');
  }
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: String(appId)
  }));
  const unsigned = `${header}.${payload}`;
  const signature = rsaSign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}
