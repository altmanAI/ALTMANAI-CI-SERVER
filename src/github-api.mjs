import { createGitHubAppJwt } from './crypto.mjs';

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseResponseBody(text, contentType) {
  if (!text) return null;
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: 'GitHub returned malformed JSON', raw: text.slice(0, 500) };
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export class GitHubApi {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.installationTokens = new Map();
  }

  async request(path, { method = 'GET', token, body, attempts = 3 } = {}) {
    if (!token) throw new Error(`GitHub API ${method} ${path} requires an authentication token`);

    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.fetch(`${this.config.githubApiUrl}${path}`, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': this.config.githubApiVersion,
            'User-Agent': this.config.serviceName,
            ...(body ? { 'Content-Type': 'application/json' } : {})
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.config.githubRequestTimeoutMs || 10_000)
        });

        const text = await response.text();
        const data = parseResponseBody(text, response.headers.get('content-type'));
        if (response.ok) return data;

        const error = new Error(`GitHub API ${method} ${path} failed with ${response.status}`);
        error.status = response.status;
        error.response = data;
        lastError = error;

        if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) throw error;
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 10_000)
          : 250 * (2 ** (attempt - 1));
        await sleep(delayMs);
      } catch (error) {
        lastError = error;
        const retryableNetworkError = error.name === 'TimeoutError' || error.name === 'AbortError' || error.code === 'ECONNRESET';
        if (!retryableNetworkError || attempt === attempts) throw error;
        await sleep(250 * (2 ** (attempt - 1)));
      }
    }
    throw lastError;
  }

  async getToken(installationId) {
    if (this.config.githubToken) return this.config.githubToken;
    if (!installationId) throw new Error('Webhook payload is missing installation.id');

    const cacheKey = String(installationId);
    const cached = this.installationTokens.get(cacheKey);
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

    const jwt = createGitHubAppJwt({
      appId: this.config.githubAppId,
      privateKey: this.config.githubPrivateKey
    });
    const response = await this.request(`/app/installations/${encodeURIComponent(cacheKey)}/access_tokens`, {
      method: 'POST',
      token: jwt
    });
    if (!response?.token || !response?.expires_at) throw new Error('GitHub installation token response is incomplete');
    this.installationTokens.set(cacheKey, {
      token: response.token,
      expiresAt: Date.parse(response.expires_at)
    });
    return response.token;
  }

  async paginate(path, token) {
    const items = [];
    for (let page = 1; page <= 20; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = await this.request(`${path}${separator}per_page=100&page=${page}`, { token });
      if (!Array.isArray(batch)) throw new Error(`GitHub API pagination expected an array for ${path}`);
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new Error(`GitHub API pagination limit exceeded for ${path}; refusing to evaluate incomplete evidence`);
  }

  getPullRequest(owner, repo, number, token) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, { token });
  }

  getPullRequestFiles(owner, repo, number, token) {
    return this.paginate(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files`, token);
  }

  getIssueComments(owner, repo, number, token) {
    return this.paginate(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`, token);
  }

  createCheckRun(owner, repo, token, payload) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/check-runs`, {
      method: 'POST',
      token,
      body: payload
    });
  }
}
