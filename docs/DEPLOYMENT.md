# Deployment and Production Controls

The canonical production procedures are:

- [`PHASE_1_DEPLOYMENT.md`](PHASE_1_DEPLOYMENT.md) — Fly.io and Railway deployment, validation, rollout, monitoring, and rollback
- [`GITHUB_APP_PRODUCTION.md`](GITHUB_APP_PRODUCTION.md) — least-privilege GitHub App registration, installation, branch protection, and credential rotation
- [`OPERATIONS.md`](OPERATIONS.md) — routine checks, backup verification, restore drills, severity model, and incident containment

## Minimum production platform

A supported platform must provide:

- managed HTTPS ingress;
- secret management;
- persistent encrypted storage;
- recoverable snapshots or external durable evidence storage;
- structured log collection with redaction controls;
- non-root container execution;
- outbound HTTPS access to `api.github.com`;
- health and readiness checks;
- a documented rollback mechanism.

## Required production secrets

- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `FOUNDER_NAME`
- `FOUNDER_GITHUB_LOGIN`
- `FOUNDER_GITHUB_USER_ID`
- `ALLOWED_GITHUB_OWNER`

`WEBHOOK_SECRET_PREVIOUS` is optional and must exist only during a controlled rotation window. `GITHUB_TOKEN` must remain unset in production and `ALLOW_STATIC_GITHUB_TOKEN` must remain `false`.

## Phase 1 Fly.io target

The committed Fly configuration provides:

- forced HTTPS;
- a persistent volume mounted at `/app/data`;
- automatic scheduled snapshots with 30-day retention;
- readiness checks against `/readyz`;
- request concurrency limits;
- automatic volume expansion thresholds;
- one continuously running Machine in `iad`;
- non-secret runtime configuration in `fly.toml` and secrets stored separately.

## Evidence durability

Phase 1 retains an append-only NDJSON active ledger but removes dependence on an ephemeral container filesystem.

Required controls:

1. mount persistent encrypted storage at `/app/data`;
2. keep platform snapshots enabled;
3. run `npm run backup-ledger` at least daily and after material changes;
4. run `npm run verify-backup` against every new backup;
5. perform a staging restore drill monthly;
6. migrate to external object-lock storage or a managed shared database in Phase 2.

## Observability

The service emits structured JSON logs. Alert on:

- readiness failure;
- sustained 5xx responses;
- GitHub API 401, 403, or 429 responses;
- webhook signature failures above baseline;
- rate-limit exhaustion during legitimate delivery traffic;
- ledger or backup verification failure;
- event-processing latency;
- volume usage above the operating threshold.

## Production authentication rule

Use `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` in production. Static `GITHUB_TOKEN` authentication remains rejected unless a documented emergency exception explicitly sets `ALLOW_STATIC_GITHUB_TOKEN=true`.

## Rollout order

1. staging GitHub App and staging deployment;
2. production instance protecting `ALTMANAI-CI-SERVER` itself;
3. seven-day observation and documented restore test;
4. one additional repository after explicit human approval;
5. wider expansion only after Phase 2 shared durability and reliability controls.

## Integrity boundary

Phase 1 materially improves deployability, durability, abuse resistance, credential rotation, and recovery evidence. It does not constitute penetration testing, independent certification, multi-region high availability, load certification, or immutable external ledger replication.
