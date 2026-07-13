# Proof

## Verified v0.2.0 baseline

The v0.2.0 repository includes executable tests for:

- GitHub's documented HMAC-SHA256 webhook validation vector;
- required GitHub event and delivery headers;
- invalid webhook-signature rejection;
- repository-backed Blake Hunter Altman × AltmanAI Model 2.0 verification data;
- verification-statement SHA-256 validation at startup;
- exact Founder login, immutable GitHub user ID, and standalone phrase enforcement;
- credential-like file blocking;
- exact Markdown PR-section detection;
- case-insensitive AI-assistance disclosure;
- production GitHub App authentication enforcement;
- explicit opt-in before production static-token use;
- GitHub API retry and non-JSON error handling;
- fail-closed pagination limits;
- hash-chain creation and tamper detection;
- serialized concurrent evidence writes and verification;
- webhook replay protection;
- identity-bound evidence records;
- health, status, verification, and smoke-test behavior.

The July 13, 2026 v0.2.0 audit completed **38 tests with 38 passes and 0 failures** on Node.js `v22.16.0`.

## Phase 1 production controls

The production-hardening branch adds:

- non-root UID/GID `10001` with `tini` as PID 1;
- read-only Compose root filesystem, dropped capabilities, and `no-new-privileges`;
- Fly.io HTTPS ingress, persistent volume, readiness checks, concurrency controls, and one continuously running Machine;
- scheduled Fly volume snapshots with 30-day retention;
- verified gzip ledger backups with SHA-256 manifests;
- independent restore verification that replays the evidence chain;
- webhook rate limiting with trusted-proxy support;
- overlapping webhook-secret rotation;
- a manual production deployment workflow with immutable action pins and a GitHub `production` environment;
- GitHub App, deployment, operations, rollback, and incident runbooks;
- five additional repository tests covering rate limiting, secret rotation, production configuration, backup verification, and backup tamper rejection.

## Phase 1 focused validation

After reconciling the package onto the newer v0.2.0 baseline, the following focused checks passed:

- JavaScript syntax validation for the merged application, configuration, backup, and verification modules;
- Phase 1 configuration parsing and invalid trusted-proxy rejection;
- previous webhook-secret acceptance during a controlled rotation window;
- per-client rate limiting with HTTP 429 and `Retry-After`;
- creation of a two-record hash-chained ledger;
- compressed backup creation with a SHA-256 manifest;
- isolated backup restore and full chain verification;
- deliberate backup tampering rejected by digest verification.

The complete integrated repository test suite must be executed again from a trusted checkout before merge or deployment. GitHub-hosted Actions execution remains restricted for the account, so this requirement is intentionally not represented as complete.

## Validation commands

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
npm pack --dry-run
```

## Authorization proof

The exact Blake Hunter Altman verification statement and its SHA-256 digest are recorded in [`VERIFICATION.md`](VERIFICATION.md) and [`config/verification.json`](config/verification.json). The runtime validates that digest during startup and exposes the non-secret record at `GET /v1/verification`.

## Evidence format

Runtime evidence is newline-delimited JSON. Each record includes `previous_hash` and `record_hash`, creating a linear SHA-256 chain. Governance decisions also record the authorizing human, immutable GitHub user ID, AI execution partner, and authorization record ID.

Application backup manifests record:

- source ledger digest;
- compressed backup digest;
- record count;
- final record hash;
- source and backup sizes;
- environment and region metadata.

## Limitations

- Phase 1 still uses one active ledger file on one persistent volume. Scheduled snapshots and verified backups improve recoverability, but external object-lock replication or a managed shared store remains Phase 2 work.
- The in-memory rate limiter is instance-local. Multi-instance deployment requires a shared rate-limit store or edge enforcement.
- Duplicate protection is process-local plus ledger-backed; clustered deployments need shared storage or a queue.
- The service does not scan complete file contents for secrets; it must be paired with GitHub secret scanning and push protection.
- The service does not configure branch protection automatically.
- Live Docker-image execution, Fly.io deployment, restore-from-platform-snapshot validation, load testing, and the full integrated test suite remain explicit pre-production gates.
- Independent penetration testing and production certification remain separate activities.
