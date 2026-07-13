# altmanai-ci-server

**Human-authorized CI governance, GitHub check enforcement, and tamper-evident proof for AltmanAI repositories.**

`altmanai-ci-server` is the central policy service for AltmanAI's GitHub delivery pipeline. It receives GitHub App webhooks, validates every delivery, evaluates pull requests against versioned governance rules, publishes a GitHub Check, and records the decision in an append-only hash-chained evidence ledger.

> Humanity leads. Intelligence follows.

## Status

**Version:** `0.1.0`  
**Maturity:** functional foundation with Phase 1 production deployment package; not yet production-certified  
**Runtime:** Node.js 22+, zero runtime package dependencies

Production use requires completion of the staged deployment, GitHub App installation, restore drill, self-governance matrix, monitoring setup, and Founder-approved branch protection described in the deployment runbooks.

## Core controls

- HMAC-SHA256 validation of the untouched GitHub webhook body
- Controlled overlap for webhook-secret rotation
- Configurable per-client webhook rate limiting
- Request-body size enforcement
- Exact Founder approval gate for material changes
- Required PR evidence, rollback, and AI-assistance disclosure sections
- Credential and private-key path blocking
- GitHub Checks API reporting
- Hash-chained NDJSON evidence records
- Duplicate delivery detection
- Repository-owner allowlisting
- Structured JSON logging
- Health, readiness, and non-sensitive status endpoints
- Container-first deployment and first-party test coverage

## Phase 1 production package

The repository now includes:

- hardened non-root `Dockerfile` with `tini` and readiness healthcheck;
- `docker-compose.yml` with a read-only root filesystem, dropped capabilities, and persistent data volume;
- `fly.toml` with forced HTTPS, persistent storage, automatic daily snapshots, 30-day retention, health checks, and capacity limits;
- verified ledger backup and restore tooling;
- a manual Fly.io deployment workflow staged for use after GitHub-hosted Actions execution is restored;
- least-privilege GitHub App setup and credential-rotation instructions;
- deployment, operations, monitoring, incident, rollback, and restore procedures.

Start with:

- [`docs/PHASE_1_DEPLOYMENT.md`](docs/PHASE_1_DEPLOYMENT.md)
- [`docs/GITHUB_APP_PRODUCTION.md`](docs/GITHUB_APP_PRODUCTION.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)

## Approval semantics

A material change is approved only when all configured policy requirements pass and the configured Founder GitHub identity posts this exact standalone pull-request comment:

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
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm start
```

Then verify:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl http://localhost:8080/v1/status
```

## GitHub App configuration

Create a GitHub App owned by the account or organization that controls the protected AltmanAI repositories.

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

Store the webhook secret and GitHub App private key in the deployment platform's secret manager. Never place them in source control. Follow the complete procedure in [`docs/GITHUB_APP_PRODUCTION.md`](docs/GITHUB_APP_PRODUCTION.md).

## Configuration

The enforcement policy is versioned in [`config/policy.json`](config/policy.json). Runtime settings are documented in [`.env.example`](.env.example).

The production authentication path uses a GitHub App ID and private key to mint short-lived installation tokens. `GITHUB_TOKEN` exists only as a local-development fallback and must remain unset in production.

## Test, proof, and backup commands

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

The recommended Phase 1 production target is Fly.io with a persistent encrypted volume. Railway is documented as an alternative. See [`docs/PHASE_1_DEPLOYMENT.md`](docs/PHASE_1_DEPLOYMENT.md).

## Evidence boundaries

The ledger demonstrates whether stored records were altered after creation. Fly volume snapshots and verified compressed backups improve recoverability, but they do not replace independent immutable object storage, shared multi-instance state, GitHub audit logs, penetration testing, or legal review. Phase 2 must move the evidence layer to object-lock storage or a managed shared database.

## Governance

Final corporate, legal, financial, publishing, deployment, and approval authority remains human. AI assistance may analyze, draft, test, and recommend, but it cannot issue Founder authorization.

See [`GOVERNANCE.md`](GOVERNANCE.md), [`PROOF.md`](PROOF.md), and [`SECURITY.md`](SECURITY.md).
