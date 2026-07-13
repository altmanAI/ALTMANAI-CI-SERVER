# altmanai-ci-server

**Human-authorized CI governance, GitHub check enforcement, and tamper-evident proof for AltmanAI repositories.**

`altmanai-ci-server` is the central policy service for AltmanAI's GitHub delivery pipeline. It receives GitHub App webhooks, validates every delivery, evaluates pull requests against versioned governance rules, publishes a GitHub Check, and records the decision in an append-only hash-chained evidence ledger.

> Humanity leads. Intelligence follows.

## Status

**Version:** `0.2.0`
**Maturity:** functional foundation; not yet production-certified
**Runtime:** Node.js 22+, zero runtime package dependencies

## Core controls

- HMAC-SHA256 validation of the untouched GitHub webhook body
- Founder approval bound to the exact `altmanAI` login and immutable GitHub user ID `233472124`
- Required PR evidence, rollback, and AI-assistance disclosure sections
- Credential and private-key path blocking
- GitHub Checks API reporting
- Hash-chained NDJSON evidence records
- Concurrent and ledger-backed duplicate delivery detection
- Repository-owner allowlisting
- Health, readiness, status, and repository-backed verification endpoints
- Container-first deployment and first-party test coverage

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

Create a GitHub App owned by the AltmanAI organization and configure:

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

The production authentication path uses a GitHub App ID and private key to mint and cache short-lived installation tokens. Static `GITHUB_TOKEN` use is rejected in production unless `ALLOW_STATIC_GITHUB_TOKEN=true` is explicitly configured.

## Test and verification commands

```bash
npm run check
npm test
npm run smoke
npm run verify-ledger
```

## Deployment

Build and run locally:

```bash
docker build -t altmanai-ci-server:0.2.0 .
docker run --rm -p 8080:8080 --env-file .env altmanai-ci-server:0.2.0
```

Production requirements and hardening steps are documented in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Evidence boundaries

The ledger demonstrates whether stored records were altered after creation. It does not replace durable external storage, independent timestamping, branch protection, GitHub audit logs, or legal review. Production should ship ledger records to immutable object storage or a database with retention controls.

## Governance

Final corporate, legal, financial, publishing, deployment, and approval authority remains human. AI assistance may analyze, draft, test, and recommend, but it cannot issue Founder authorization.

See [`VERIFICATION.md`](VERIFICATION.md), [`GOVERNANCE.md`](GOVERNANCE.md), [`PROOF.md`](PROOF.md), and [`SECURITY.md`](SECURITY.md).
