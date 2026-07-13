# Deployment

The authoritative Phase 1 procedure is [`PHASE_1_DEPLOYMENT.md`](PHASE_1_DEPLOYMENT.md). Production GitHub App creation and rotation are defined in [`GITHUB_APP_SETUP.md`](GITHUB_APP_SETUP.md).

## Minimum production platform

- managed HTTPS ingress
- secret manager
- persistent encrypted volume or external evidence store
- automatic storage snapshots and a tested recovery procedure
- log aggregation with redaction controls
- container runtime supporting non-root execution
- outbound HTTPS access to `api.github.com`
- health and readiness monitoring
- controlled deployment and rollback path

## Required production secrets

- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`

Founder identity, policy paths, rate limits, and service metadata are non-secret settings in `fly.toml`. They remain security-sensitive configuration and require code review.

## Phase 1 target

The committed Fly.io configuration provides:

- one always-running Machine in `iad`;
- HTTPS enforcement;
- durable evidence storage mounted at `/app/data`;
- daily volume snapshots with 30-day retention;
- automatic volume extension within a bounded limit;
- health and full ledger-readiness checks;
- request concurrency boundaries;
- a single-writer evidence architecture.

The hardened Docker Compose file is a self-hosted reference and binds the service to localhost by default. It is not a substitute for managed ingress, snapshots, monitoring, and secret management.

## Recommended rollout

1. Deploy to a private staging environment.
2. Register a staging GitHub App on only `ALTMANAI-CI-SERVER`.
3. Confirm signature validation with a GitHub `ping` event.
4. Open test PRs that exercise pass, block, authorization, replay, size-limit, and rate-limit decisions.
5. Confirm branch protection requires `AltmanAI Governance Gate`.
6. Verify the ledger after every scenario.
7. Run `npm run backup-ledger` and complete a snapshot recovery drill.
8. Perform credential-leak and webhook-replay review.
9. Verify `GET /v1/verification` matches `ALTMANAI-CI-VERIFY-2026-07-13-001`.
10. Promote only after explicit Founder authorization.

## Observability

Alert on:

- readiness failure;
- GitHub API 401, 403, or 429 responses;
- webhook signature failures above baseline;
- webhook rate-limit events above baseline;
- ledger verification failure;
- sustained 5xx responses;
- event-processing latency;
- unexpected Machine restart or volume-capacity growth.

Logs are structured JSON and must be exported to a retention-controlled sink before organization-wide rollout.

## Backup and retention

Phase 1 uses two layers:

1. Fly Volume automatic daily snapshots with 30-day retention.
2. `npm run backup-ledger`, which reads the live ledger once, verifies the exact copied snapshot bytes, and writes a timestamped NDJSON copy plus SHA-256 manifest.

Application-level backups remain on the same volume. Phase 2 must replicate verified backups to independent retention-controlled object storage or a managed database.

## Production authentication rule

Use `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` in production. Static `GITHUB_TOKEN` authentication is rejected unless `ALLOW_STATIC_GITHUB_TOKEN=true` is deliberately set and documented as a short-lived incident exception.

## Deployment workflow

`.github/workflows/deploy-fly.yml` is a human-triggered production workflow with an environment approval gate. It remains inactive until GitHub-hosted runner execution is restored and the `production` environment plus `FLY_API_TOKEN` secret are configured. Every action is pinned to an immutable commit and the reviewed `flyctl` version is hard-coded in the workflow.
