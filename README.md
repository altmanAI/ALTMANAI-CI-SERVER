# altmanai-ci-server

**Human-authorized CI governance, GitHub check enforcement, and tamper-evident proof for AltmanAI repositories.**

`altmanai-ci-server` is the central policy service for AltmanAI's GitHub delivery pipeline. It receives GitHub App webhooks, validates every delivery, evaluates pull requests against versioned governance rules, publishes a GitHub Check, and records the decision in an append-only hash-chained evidence ledger.

> Humanity leads. Intelligence follows.

## Status

**Version:** `0.2.0`  
**Maturity:** verified functional foundation with a staged Phase 1 production package; not yet production-certified  
**Runtime:** Node.js 22+, zero runtime package dependencies

## Core controls

- HMAC-SHA256 validation of untouched GitHub webhook bytes
- Controlled previous-secret overlap for safe webhook rotation
- Configurable per-client webhook rate limiting
- Request-body size enforcement
- Founder approval bound to login `altmanAI` and immutable GitHub user ID `233472124`
- Repository-backed Blake Hunter Altman × AltmanAI Model 2.0 verification record
- Required PR evidence, rollback, and AI-assistance disclosure sections
- Credential and private-key path blocking
- GitHub App authentication with static-token fail-closed behavior
- GitHub API timeout, retry, pagination, and response-handling controls
- GitHub Checks API reporting
- Concurrent, hash-chained NDJSON evidence records
- Duplicate-delivery protection
- Repository-owner allowlisting
- Structured JSON logging
- Health, readiness, status, and verification endpoints
- Container-first deployment and first-party test coverage

## Phase 1 production package

The repository includes:

- hardened non-root `Dockerfile` with `tini` and ledger-backed readiness healthcheck;
- `docker-compose.yml` with read-only root filesystem, dropped capabilities, and persistent storage;
- `fly.toml` with HTTPS, a persistent volume, scheduled snapshots, health checks, and capacity limits;
- verified evidence backup and restore tooling;
- a manually dispatched, production-environment-gated Fly.io deployment workflow with immutable action pins;
- least-privilege GitHub App setup and credential-rotation instructions;
- deployment, monitoring, incident, rollback, backup, and restore runbooks.

Start with:

- [`docs/PHASE_1_DEPLOYMENT.md`](docs/PHASE_1_DEPLOYMENT.md)
- [`docs/GITHUB_APP_PRODUCTION.md`](docs/GITHUB_APP_PRODUCTION.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)

## Approval semantics

A material change is approved only when all configured policy requirements pass and Blake Hunter Altman’s configured GitHub identity—login `altmanAI`, user ID `233472124`—posts this exact standalone pull-request comment:

```text
All Clear for Impact
```

The phrase cannot be inferred, generated, substituted, embedded in a longer sentence, or accepted from another account.

## Request flow

```text
GitHub App webhook
        |
        v
Rate limit + body limit
        |
        v
Header + signature validation
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
npm ci --ignore-scripts --no-audit --no-fund
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

**Repository permissions**

- Checks: read and write
- Contents: read
- Issues: read
- Metadata: read
- Pull requests: read

**Event subscriptions**

- Pull request
- Issue comment

**Webhook URL**

```text
https://<your-ci-host>/webhooks/github
```

Store the webhook secret and GitHub App private key only in the deployment platform's secret manager. Follow [`docs/GITHUB_APP_PRODUCTION.md`](docs/GITHUB_APP_PRODUCTION.md).

## Configuration

The enforcement policy is versioned in [`config/policy.json`](config/policy.json). The authorization record is stored in [`config/verification.json`](config/verification.json), with a human-readable copy in [`VERIFICATION.md`](VERIFICATION.md). Runtime settings are documented in [`.env.example`](.env.example).

Production uses a GitHub App ID and private key to mint short-lived installation tokens. Static `GITHUB_TOKEN` use is rejected unless an explicit, documented emergency exception enables it.

## Test, evidence, and backup commands

```bash
npm run check
npm test
npm run smoke
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
```

## Deployment

Local production rehearsal:

```bash
docker compose up --build -d
curl --fail http://127.0.0.1:8080/readyz
docker compose down
```

The recommended Phase 1 target is Fly.io with persistent encrypted storage. Railway is documented as an alternative. See [`docs/PHASE_1_DEPLOYMENT.md`](docs/PHASE_1_DEPLOYMENT.md).

## Evidence boundaries

The ledger detects alteration of stored records. Persistent volumes, scheduled snapshots, and verified compressed backups improve recoverability, but they do not replace external immutable storage, shared multi-instance state, GitHub audit logs, penetration testing, or legal review. Phase 2 must move evidence to object-lock storage or a managed shared database.

## Governance

Final corporate, legal, financial, publishing, deployment, and approval authority remains human. AI assistance may analyze, draft, test, and recommend, but it cannot issue Founder authorization.

See [`VERIFICATION.md`](VERIFICATION.md), [`GOVERNANCE.md`](GOVERNANCE.md), [`PROOF.md`](PROOF.md), and [`SECURITY.md`](SECURITY.md).
