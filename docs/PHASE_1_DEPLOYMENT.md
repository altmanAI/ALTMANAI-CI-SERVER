# Phase 1 Production Deployment

This guide deploys one hardened AltmanAI CI Server instance to Fly.io with a persistent evidence volume, automatic daily volume snapshots, health checks, a production GitHub App, and a controlled rollout to one or two repositories.

## Scope and accuracy boundary

Phase 1 is a single-instance deployment. It is designed to protect a small initial repository set, not to provide multi-region high availability. A Fly Volume is attached to one Machine at a time; the evidence ledger remains a single-writer service until Phase 2 moves evidence to shared durable storage.

Do not represent this release as production-certified until the staging scenarios, backup recovery drill, and Founder approval in this document are complete.

## 1. Prerequisites

- Fly.io account with billing configured
- `flyctl` installed and authenticated
- GitHub App created using [`GITHUB_APP_SETUP.md`](GITHUB_APP_SETUP.md)
- GitHub App ID and downloaded private key
- high-entropy webhook secret
- local clone of this repository at the exact approved revision

Confirm the local revision and validation state:

```bash
git status --short
git rev-parse HEAD
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger
npm pack --dry-run
docker build -t altmanai-ci-server:0.2.0 .
```

## 2. Review the Fly configuration

The committed [`fly.toml`](../fly.toml) uses:

- app name: `altmanai-ci-server`
- primary region: `iad`
- persistent volume name: `altmanai_ci_data`
- volume mount: `/app/data`
- daily snapshots with 30-day retention
- one always-running Machine
- `/healthz` and `/readyz` checks

Fly app names are globally unique. If `altmanai-ci-server` is unavailable, replace the `app` value in `fly.toml` and use the resulting hostname throughout this guide and the deployment workflow.

Validate the local Fly configuration before deployment:

```bash
fly config show --local
```

## 3. Create the application and volume

```bash
fly apps create altmanai-ci-server
fly volumes create altmanai_ci_data --region iad --size 1
```

Confirm the volume exists in the same region as the application Machine:

```bash
fly volumes list -a altmanai-ci-server
```

Do not create multiple application Machines in Phase 1. The local evidence ledger is intentionally single-writer.

## 4. Set production secrets

Generate the webhook secret in a secure shell session:

```bash
openssl rand -hex 32
```

Set the following with Fly's secret manager. Never place the resulting values in `.env`, shell scripts, screenshots, issues, pull requests, or repository files.

```bash
fly secrets set \
  WEBHOOK_SECRET='<generated-secret>' \
  GITHUB_APP_ID='<github-app-id>' \
  GITHUB_PRIVATE_KEY="$(cat /secure/path/altmanai-ci-server.private-key.pem)" \
  -a altmanai-ci-server
```

Confirm only secret names—not values—are present:

```bash
fly secrets list -a altmanai-ci-server
```

Production intentionally rejects a static `GITHUB_TOKEN` unless an explicit temporary exception sets `ALLOW_STATIC_GITHUB_TOKEN=true`. Do not use that exception for the normal deployment.

## 5. Deploy

```bash
fly deploy --config fly.toml --strategy rolling --wait-timeout 10m
```

Inspect Machine and application state:

```bash
fly status -a altmanai-ci-server
fly checks list -a altmanai-ci-server
fly logs -a altmanai-ci-server
```

## 6. Verify the live service

```bash
curl --fail --silent --show-error https://altmanai-ci-server.fly.dev/healthz
curl --fail --silent --show-error https://altmanai-ci-server.fly.dev/readyz
curl --fail --silent --show-error https://altmanai-ci-server.fly.dev/v1/status
curl --fail --silent --show-error https://altmanai-ci-server.fly.dev/v1/verification
```

Required results:

- `/healthz` returns HTTP 200 and version `0.2.0`
- `/readyz` returns HTTP 200 with `ledger.valid: true`
- `/v1/status` reports the active policy and authorization record
- `/v1/verification` reports `ALTMANAI-CI-VERIFY-2026-07-13-001`

## 7. Connect the GitHub App

Set the GitHub App webhook URL to:

```text
https://altmanai-ci-server.fly.dev/webhooks/github
```

Set the GitHub App webhook secret to the exact value stored as `WEBHOOK_SECRET` in Fly.

Deliver a GitHub `ping` event and confirm:

- GitHub reports a 2xx webhook response
- service logs show an accepted `ping`
- `/readyz` shows a valid ledger with at least one record

Do not log or publish the complete webhook payload.

## 8. Execute the staging test matrix

Install the GitHub App only on `ALTMANAI-CI-SERVER` first. Open controlled pull requests that prove:

1. a routine, complete PR passes without unnecessary Founder approval;
2. a material PR without approval fails;
3. the exact standalone Founder phrase from the configured GitHub identity passes;
4. the same phrase from another identity fails;
5. a forbidden credential path fails;
6. missing AI-assistance disclosure fails where policy requires it;
7. a duplicate GitHub delivery does not create a duplicate decision;
8. an invalid webhook signature returns HTTP 401;
9. an oversized body returns HTTP 413;
10. an abusive burst returns HTTP 429.

For every scenario, capture the PR URL, Check Run URL, evidence record hash, expected result, and observed result without storing secrets or private payload contents.

## 9. Enable branch protection

After `AltmanAI Governance Gate` has appeared as a real Check Run on the repository:

- require pull requests before merging;
- require the `AltmanAI Governance Gate` status check;
- require branches to be up to date before merging;
- require conversation resolution;
- block force pushes and branch deletion on `main`;
- restrict bypass authority to the minimum accountable human set.

Start with `ALTMANAI-CI-SERVER`, then add one additional core repository only after the complete staging matrix passes.

## 10. Evidence backup and verification

The Fly Volume configuration enables daily snapshots with 30-day retention. The application also contains an atomic verified backup command:

```bash
fly ssh console -a altmanai-ci-server -C 'npm run backup-ledger'
```

The command:

- verifies the hash chain before backup;
- refuses to back up a corrupt ledger;
- writes an immutable timestamped NDJSON copy;
- writes a SHA-256 manifest;
- applies configured retention to application-level backup copies.

Run it after initial staging and before every material upgrade. Phase 2 must copy verified manifests and ledger snapshots to independent object storage with retention controls.

Perform a snapshot recovery drill before production authorization. Record the snapshot identifier, restoration steps, verification output, and recovery time.

## 11. Monitoring

Configure external HTTPS monitoring for:

- `/healthz` every minute;
- `/readyz` every five minutes;
- alert on sustained 5xx responses;
- alert on repeated signature rejection or rate-limit events;
- alert on GitHub API 401, 403, or 429 responses;
- alert immediately if ledger verification fails.

Fly logs are structured JSON. Export logs to a retention-controlled sink before expanding beyond the initial repository set.

## 12. Controlled deployment workflow

The repository includes `.github/workflows/deploy-fly.yml`. It is manual-only and requires:

- execution from `main`;
- GitHub environment named `production` with required human reviewers;
- secret `FLY_API_TOKEN`;
- repository/environment variable `FLYCTL_VERSION` pinned to an approved version;
- a human-entered deployment reason.

Do not activate the workflow until the account-level GitHub-hosted runner restriction is resolved and a non-production manual run completes successfully.

## 13. Rollback

Before each deployment, record the current release and image identifiers. If the new release fails readiness or governance verification:

1. stop rollout expansion;
2. redeploy the previous known-good image;
3. confirm `/healthz`, `/readyz`, and `/v1/verification`;
4. verify the evidence ledger before accepting new webhook traffic;
5. preserve incident logs and the failed deployment revision;
6. document the correction in the repository decision record.

Never replace or truncate the evidence ledger as part of application rollback.

## 14. Phase 1 completion gate

Phase 1 is complete only when all items are true:

- [ ] GitHub App uses minimum permissions and selected-repository installation
- [ ] secrets exist only in Fly's secret manager
- [ ] one Machine is healthy in `iad`
- [ ] persistent volume and daily snapshots are verified
- [ ] staging matrix is complete with recorded evidence
- [ ] application-level ledger backup and restore drill passed
- [ ] uptime and error alerting are active
- [ ] `ALTMANAI-CI-SERVER` branch protection requires the governance gate
- [ ] one additional core repository has completed a controlled rollout
- [ ] Blake Hunter Altman has provided explicit production authorization

**Humanity leads. Intelligence follows.**
