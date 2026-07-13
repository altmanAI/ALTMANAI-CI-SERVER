import { createGitHubAppJwt } from './crypto.mjs';

export class GitHubApi {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  async request(path, { method = 'GET', token, body } = {}) {
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
      signal: AbortSignal.timeout(15_000)
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`GitHub API ${method} ${path} failed with ${response.status}`);
      error.status = response.status;
      error.response = data;
      throw error;
    }
    return data;
  }

  async getToken(installationId) {
    if (this.config.githubToken) return this.config.githubToken;
    if (!installationId) throw new Error('Webhook payload is missing installation.id');
    const jwt = createGitHubAppJwt({
      appId: this.config.githubAppId,
      privateKey: this.config.githubPrivateKey
    });
    const response = await this.request(`/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      token: jwt
    });
    return response.token;
  }

  async paginate(path, token) {
    const items = [];
    for (let page = 1; page <= 20; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = await this.request(`${path}${separator}per_page=100&page=${page}`, { token });
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }

  getPullRequest(owner, repo, number, token) {
    return this.request(`/repos/${owner}/${repo}/pulls/${number}`, { token });
  }

  getPullRequestFiles(owner, repo, number, token) {
    return this.paginate(`/repos/${owner}/${repo}/pulls/${number}/files`, token);
  }

  getIssueComments(owner, repo, number, token) {
    return this.paginate(`/repos/${owner}/${repo}/issues/${number}/comments`, token);
  }

  createCheckRun(owner, repo, token, payload) {
    return this.request(`/repos/${owner}/${repo}/check-runs`, {
      method: 'POST',
      token,
      body: payload
    });
  }
}
