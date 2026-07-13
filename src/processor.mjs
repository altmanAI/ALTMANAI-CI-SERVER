import { evaluatePullRequest } from './policy-engine.mjs';
import { sha256 } from './crypto.mjs';

const PR_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'edited', 'ready_for_review']);
const COMMENT_ACTIONS = new Set(['created', 'edited', 'deleted']);

function repositoryCoordinates(payload) {
  const fullName = payload.repository?.full_name;
  if (!fullName || !fullName.includes('/')) throw new Error('Webhook payload is missing repository.full_name');
  const [owner, repo, ...remainder] = fullName.split('/');
  if (!owner || !repo || remainder.length) throw new Error('Webhook repository.full_name is invalid');
  return { owner, repo, fullName };
}

function pullRequestCoordinates(pullRequest, fallbackNumber) {
  const number = Number(pullRequest?.number || fallbackNumber);
  const headSha = pullRequest?.head?.sha;
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Pull request number is invalid');
  if (!headSha || typeof headSha !== 'string') throw new Error('Pull request head SHA is missing');
  return { number, headSha };
}

export class WebhookProcessor {
  constructor({ config, github, ledger, logger }) {
    this.config = config;
    this.github = github;
    this.ledger = ledger;
    this.logger = logger;
  }

  async process({ event, deliveryId, payload }) {
    this.assertAllowedRepository(payload);
    if (!this.ledger.tryBeginDelivery(deliveryId)) {
      return { accepted: true, duplicate: true };
    }

    try {
      if (event === 'ping') {
        await this.ledger.append({
          delivery_id: deliveryId,
          event,
          decision: 'accepted',
          zen: payload.zen || null,
          authorization_record_id: this.config.authorizationRecordId
        });
        return { accepted: true, event, message: 'pong' };
      }

      if (event === 'pull_request' && PR_ACTIONS.has(payload.action)) {
        return await this.evaluateAndReport({ event, deliveryId, payload, pullRequest: payload.pull_request });
      }

      if (event === 'issue_comment' && COMMENT_ACTIONS.has(payload.action) && payload.issue?.pull_request) {
        const { owner, repo } = repositoryCoordinates(payload);
        const token = await this.github.getToken(payload.installation?.id);
        const pullRequest = await this.github.getPullRequest(owner, repo, payload.issue.number, token);
        return await this.evaluateAndReport({ event, deliveryId, payload, pullRequest, token });
      }

      await this.ledger.append({
        delivery_id: deliveryId,
        event,
        action: payload.action || null,
        repository: payload.repository?.full_name || null,
        decision: 'ignored',
        authorization_record_id: this.config.authorizationRecordId
      });
      return { accepted: true, ignored: true, event, action: payload.action || null };
    } finally {
      this.ledger.endDelivery(deliveryId);
    }
  }

  assertAllowedRepository(payload) {
    const fullName = payload.repository?.full_name;
    if (!fullName || !this.config.allowedGitHubOwner) return;
    const [owner] = fullName.split('/');
    if (owner.toLowerCase() !== this.config.allowedGitHubOwner.toLowerCase()) {
      const error = new Error(`Repository owner is not allowed: ${owner}`);
      error.status = 403;
      throw error;
    }
  }

  async evaluateAndReport({ event, deliveryId, payload, pullRequest, token: suppliedToken }) {
    const { owner, repo, fullName } = repositoryCoordinates(payload);
    const { number, headSha } = pullRequestCoordinates(pullRequest, payload.issue?.number);
    const token = suppliedToken || await this.github.getToken(payload.installation?.id);
    const [files, comments] = await Promise.all([
      this.github.getPullRequestFiles(owner, repo, number, token),
      this.github.getIssueComments(owner, repo, number, token)
    ]);

    const result = evaluatePullRequest({
      policy: this.config.policy,
      pullRequest,
      files,
      comments,
      founderLogin: this.config.founderGitHubLogin,
      founderUserId: this.config.founderGitHubUserId,
      approvalPhrase: this.config.founderApprovalPhrase
    });

    const checkRun = await this.github.createCheckRun(owner, repo, token, {
      name: this.config.policy.checkName,
      head_sha: headSha,
      status: 'completed',
      conclusion: result.conclusion,
      external_id: `${fullName}#${number}:${deliveryId}`,
      completed_at: new Date().toISOString(),
      output: {
        title: result.title,
        summary: result.summary,
        annotations: result.annotations
      }
    });

    const evidence = await this.ledger.append({
      delivery_id: deliveryId,
      event,
      action: payload.action || null,
      repository: fullName,
      pull_request_number: number,
      head_sha: headSha,
      policy_version: this.config.policy.policyVersion,
      policy_digest: sha256(JSON.stringify(this.config.policy)),
      decision: result.conclusion,
      finding_codes: result.findings.map((item) => item.code),
      founder_approval_recorded: result.metadata.founderApproved,
      authorizing_human: this.config.founderName,
      authorizing_github_login: this.config.founderGitHubLogin,
      authorizing_github_user_id: this.config.founderGitHubUserId,
      ai_execution_partner: this.config.aiPartnerName,
      authorization_record_id: this.config.authorizationRecordId,
      check_run_id: checkRun.id,
      check_run_url: checkRun.html_url || null
    });

    this.logger.info('Pull request evaluated', {
      repository: fullName,
      pullRequest: number,
      conclusion: result.conclusion,
      findings: result.findings.length,
      evidenceRecord: evidence.record_id,
      authorizationRecord: this.config.authorizationRecordId
    });

    return {
      accepted: true,
      event,
      repository: fullName,
      pullRequest: number,
      conclusion: result.conclusion,
      findings: result.findings.length,
      checkRunUrl: checkRun.html_url || null,
      evidenceHash: evidence.record_hash,
      authorizationRecordId: this.config.authorizationRecordId
    };
  }
}
