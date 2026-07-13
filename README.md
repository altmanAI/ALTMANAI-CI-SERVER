# altmanai-ci-server

**Human-authorized CI governance, GitHub check enforcement, and tamper-evident proof for AltmanAI repositories.**

`altmanai-ci-server` is the central policy service for AltmanAI's GitHub delivery pipeline. It receives GitHub App webhooks, validates every delivery, evaluates pull requests against versioned governance rules, publishes a GitHub Check, and records the decision in an append-only hash-chained evidence ledger.

> Humanity leads. Intelligence follows.

## Status

**Version:** `0.2.0`  
**Maturity:** production-hardening Phase 1; not yet production-certified  
**Runtime:** Node.js 22+, zero runtime package dependencies

## Core controls

- HMAC-SHA256 validation of the untouched GitHub webhook body
- configurable body-size and per-client webhook rate limits
- trusted-proxy headers disabled by default and explicit in production
- Founder approval bound to the exact `altmanAI` login and immutable GitHub user ID `233472124`
- required PR evidence, rollback, and AI-assistance disclosure sections
- credential and private-key path blocking
- GitHub Checks API reporting
- hash-chained NDJSON evidence records
- concurrent and ledger-backed duplicate delivery detection
- repository-owner allowlisting
- health, readiness, status, and repository-backed verification endpoints
- atomic verified evidence backups with SHA-256 manifests
- non-root container, durable Fly volume, and health-checked deployment configuration
- human-gated production deployment workflow

## Approval semantics

A material change is approved only when all configured policy requirements pass and Blake Hunter Altman's configured GitHub identity—login `altmanAI`, user ID `233472124`—posts this exact standalone pull-request comment:

```text
All Clear for Impact
```

The phrase cannot be inferred, generated, substituted, embedded in a longer sentence, or accepted from another account.

## Request flow

```text
GitHub App webhook
        |
        v
Rate + size controls
        |
        v
Signature validation
        |
        v
Event normalization ----> ignored-event evidence record
        |
        v
PR files + comments retrieval
        |
        v
Versioned policy evaluation
        |
        +----> GitHub Check Run
        |
        +----> Hash-chained evidence ledger
```

## Supported webhook events

- `ping`
- `pull_request`: `opened`, `reopened`, `synchronize`, `edited`, `ready_for_review`
- `issue_comment` on pull requests, used to re-evaluate Founder authorization

Other events are acknowledged and recorded as ignored.

## Local start

```bash
cp .env.example .env
set -a && source .env && set +a
npm test
npm start
```

Then verify:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl http://localhost:8080/v1/status
curl http://localhost:8080/v1/verification
```

## GitHub App configuration

Create a dedicated GitHub App owned by the accountable `altmanAI` GitHub account. Follow [`docs/GITHUB_APP_SETUP.md`](docs/GITHUB_APP_SETUP.md).

**Repository permissions**

- Checks: read and write
- Contents: read
- Issues: read
- Metadata: read
- Pull requests: read

**Subscribe to events**

- Pull request
- Issue comment

**Webhook URL**

```text
https://<your-ci-host>/webhooks/github
```

Store the webhook secret and GitHub App private key in the deployment platform's secret manager. Never place them in source control.

## Configuration

The enforcement policy is versioned in [`config/policy.json`](config/policy.json). The Blake Hunter Altman × AltmanAI Model 2.0 authorization record is stored in [`config/verification.json`](config/verification.json), with a human-readable copy in [`VERIFICATION.md`](VERIFICATION.md). Runtime settings are documented in [`.env.example`](.env.example).

The production authentication path uses a GitHub App ID and private key to mint and cache short-lived installation tokens. Static `GITHUB_TOKEN` use is rejected in production unless `ALLOW_STATIC_GITHUB_TOKEN=true` is explicitly configured and documented as an emergency exception.

## Test and verification commands

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger
npm run backup-ledger
npm pack --dry-run
```

## Deployment

Local hardened reference:

```bash
docker compose up --build --detach
```

Fly.io Phase 1:

- [`fly.toml`](fly.toml) — persistent volume, daily snapshots, health checks, bounded concurrency
- [`docs/PHASE_1_DEPLOYMENT.md`](docs/PHASE_1_DEPLOYMENT.md) — complete deployment and rollout gate
- [`docs/GITHUB_APP_SETUP.md`](docs/GITHUB_APP_SETUP.md) — permissions, installation, and rotation
- [`.github/workflows/deploy-fly.yml`](.github/workflows/deploy-fly.yml) — human-triggered production deployment after hosted runners recover

## Evidence boundaries

The ledger demonstrates whether stored records were altered after creation. Phase 1 improves durability through a persistent volume, daily snapshots, and verified timestamped backup manifests. It does not replace independent immutable object storage, multi-instance shared state, external timestamping, GitHub audit logs, or legal review. Those remain Phase 2 requirements.

## Governance

Final corporate, legal, financial, publishing, deployment, and approval authority remains human. AI assistance may analyze, draft, test, and recommend, but it cannot issue Founder authorization.

See [`VERIFICATION.md`](VERIFICATION.md), [`GOVERNANCE.md`](GOVERNANCE.md), [`PROOF.md`](PROOF.md), and [`SECURITY.md`](SECURITY.md).
