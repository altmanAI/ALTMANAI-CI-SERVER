# Changelog

All notable changes to `altmanai-ci-server` are documented here. The project follows evidence-based release notes: an entry describes implemented repository changes, not a claim that production deployment has occurred.

## Unreleased — Phase 1 production hardening

### Added

- Fly.io production configuration with HTTPS enforcement, persistent volume, readiness checks, request concurrency controls, automatic daily snapshots, and 30-day snapshot retention.
- Hardened Docker Compose deployment with a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, persistent storage, bounded logs, and readiness healthcheck.
- Verified compressed evidence-ledger backups with SHA-256 manifests.
- Independent backup restoration and hash-chain verification.
- Per-client webhook rate limiting with trusted-proxy support.
- Current and previous webhook-secret support for controlled rotations.
- Manual Fly.io deployment workflow gated through the GitHub `production` environment.
- Production GitHub App, deployment, operations, incident, rollback, backup, and restore runbooks.
- Automated tests for rate limiting, secret rotation, production configuration, backup verification, and backup tamper rejection.

### Changed

- Production container now runs through `tini` as non-root UID/GID `10001`.
- Container readiness healthcheck now verifies the ledger-backed `/readyz` endpoint.
- Environment template now distinguishes production secrets, non-secret settings, storage paths, rate limits, and rotation controls.
- Deployment and proof documentation now distinguish completed repository hardening from pending live deployment validation.

### Validation

- Nine targeted Phase 1 tests passed locally.
- Modified JavaScript files passed syntax validation.
- A two-record ledger was backed up, restored, and fully verified.
- Deliberate compressed-backup tampering was rejected.
- `fly.toml` and `docker-compose.yml` parsed successfully.

### Known limitations

- Docker image execution and live Fly deployment remain first-deployment gates because the validation environment did not provide a Docker daemon and GitHub-hosted Actions execution remains restricted.
- The active ledger and rate limiter remain single-instance Phase 1 implementations. Shared durable state and distributed enforcement are Phase 2 work.

## 0.1.0 — Initial functional foundation

- GitHub webhook ingress with HMAC-SHA256 verification.
- GitHub App and installation-token authentication.
- Deterministic pull-request governance policy engine.
- Exact Founder authorization semantics.
- GitHub Check Run publication.
- Append-only SHA-256 evidence ledger.
- Duplicate-delivery protection.
- Health, readiness, and status endpoints.
- Docker runtime, tests, OpenAPI specification, and governance documentation.
