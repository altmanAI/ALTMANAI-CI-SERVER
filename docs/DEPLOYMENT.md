# Deployment and Production Controls

The canonical Phase 1 deployment procedure is:

- [`PHASE_1_DEPLOYMENT.md`](PHASE_1_DEPLOYMENT.md) — Fly.io and Railway deployment, validation, rollout, monitoring, and rollback
- [`GITHUB_APP_PRODUCTION.md`](GITHUB_APP_PRODUCTION.md) — least-privilege GitHub App registration, installation, branch protection, and credential rotation
- [`OPERATIONS.md`](OPERATIONS.md) — routine checks, backup verification, restore drills, severity model, and incident containment

## Minimum production platform

A supported platform must provide:

- managed HTTPS ingress;
- secret management;
- persistent encrypted storage;
- automatic recoverable snapshots or external durable evidence storage;
- structured log collection with redaction controls;
- non-root container execution;
- outbound HTTPS access to `api.github.com`;
- health and readiness checks;
- a documented rollback mechanism.

## Required production secrets

- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `FOUNDER_GITHUB_LOGIN`
- `ALLOWED_GITHUB_OWNER`

`WEBHOOK_SECRET_PREVIOUS` is optional and must exist only during a controlled rotation window. `GITHUB_TOKEN` must remain unset in production.

## Current Phase 1 deployment target

The committed Fly.io configuration provides:

- a continuously running Machine in `iad`;
- forced HTTPS;
- a persistent volume mounted at `/app/data`;
- automatic daily snapshots with 30-day retention;
- readiness checks against `/readyz`;
- request concurrency limits;
- automatic volume expansion thresholds;
- a bounded rolling deployment strategy;
- non-sensitive runtime configuration in `fly.toml` and secrets stored separately.

## Evidence durability

The active ledger remains an append-only NDJSON file during Phase 1, but it is no longer intended to live on an ephemeral container filesystem.

Required controls:

1. mount persistent encrypted storage at `/app/data`;
2. keep scheduled platform snapshots enabled;
3. run `npm run backup-ledger` after material changes and at least daily;
4. run `npm run verify-backup` against each new backup;
5. perform a staging restore drill at least monthly;
6. move to external object-lock storage or a managed database during Phase 2.

## Observability

The service emits structured JSON logs. Alert on:

- readiness failure;
- sustained 5xx responses;
- GitHub API 401, 403, or 429 responses;
- webhook signature failures above baseline;
- rate-limit exhaustion during legitimate delivery traffic;
- ledger verification failure;
- backup or restore verification failure;
- event-processing latency;
- volume usage above the operating threshold.

## Rollout order

1. staging GitHub App and staging deployment;
2. production instance protecting `ALTMANAI-CI-SERVER` itself;
3. seven-day observation and documented restore test;
4. one additional core repository after explicit human approval;
5. organization-wide expansion only after Phase 2 durability and reliability controls are complete.

## Integrity boundary

Phase 1 materially improves deployability, durability, abuse resistance, credential rotation, and recovery evidence. It does not constitute penetration testing, independent certification, multi-region high availability, or immutable external ledger replication.
