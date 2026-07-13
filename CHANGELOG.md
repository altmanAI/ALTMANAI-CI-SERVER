# Changelog

All notable changes to `altmanai-ci-server` are documented here. Entries describe implemented repository changes, not claims that a live production deployment has occurred.

## Unreleased — Phase 1 production hardening

### Added

- Fly.io production configuration with HTTPS enforcement, persistent volume, readiness checks, concurrency controls, scheduled snapshots, and 30-day retention.
- Hardened Docker Compose deployment with a read-only root filesystem, dropped capabilities, `no-new-privileges`, persistent storage, and bounded logs.
- Verified compressed evidence-ledger backups with SHA-256 manifests.
- Independent backup restoration and full hash-chain verification.
- Per-client webhook rate limiting with trusted-proxy support.
- Current and previous webhook-secret support for controlled rotations.
- Manual Fly.io deployment workflow gated through the GitHub `production` environment and pinned to immutable action revisions.
- Production GitHub App, deployment, operations, incident, rollback, backup, and restore runbooks.
- Automated tests for rate limiting, secret rotation, production configuration, backup verification, and backup tamper rejection.

### Changed

- Production container runs through `tini` as non-root UID/GID `10001`.
- Container healthcheck verifies the ledger-backed `/readyz` endpoint.
- Environment template distinguishes secrets, public settings, storage paths, rate limits, and rotation controls.
- Deployment and proof documentation distinguish completed repository hardening from pending live deployment validation.

### Known limitations

- Live Docker and Fly.io execution remain deployment gates until a trusted operator configures the platform account and secrets.
- GitHub-hosted Actions execution remains restricted for the AltmanAI account, so deployment automation is intentionally manual-only.
- The active ledger and rate limiter remain single-instance Phase 1 implementations. Shared durable state and distributed enforcement are Phase 2 work.

## 0.2.0 — Verified functional foundation

- Bound Founder approval to both GitHub login and immutable user ID.
- Added repository-backed verification records and startup digest validation.
- Hardened GitHub App authentication, API retries, timeouts, pagination, and error handling.
- Serialized evidence writes and verification.
- Expanded the verified test baseline to 38 passing tests.

## 0.1.0 — Initial functional foundation

- GitHub webhook ingress with HMAC-SHA256 verification.
- GitHub App installation-token authentication.
- Deterministic pull-request governance policy engine.
- Exact Founder authorization semantics.
- GitHub Check Run publication.
- Append-only SHA-256 evidence ledger.
- Duplicate-delivery protection.
- Health, readiness, and status endpoints.
- Docker runtime, tests, OpenAPI specification, and governance documentation.
