# Proof

## Current verified capabilities

The repository includes executable tests for:

- GitHub's documented HMAC-SHA256 webhook validation vector;
- invalid webhook-signature rejection;
- controlled overlap with a previous webhook secret during rotation;
- per-client webhook rate limiting and `Retry-After` response behavior;
- exact Founder identity and standalone phrase enforcement;
- credential-like file blocking;
- required AI-assistance disclosure;
- hash-chain creation and tamper detection;
- health endpoint behavior;
- production configuration validation.

## Phase 1 deployment controls

The production-hardening package adds:

- non-root UID/GID `10001` with `tini` as PID 1;
- read-only Compose root filesystem, dropped capabilities, and `no-new-privileges`;
- Fly.io HTTPS ingress, readiness checks, request concurrency controls, and a continuously running Machine;
- an encrypted persistent volume mount at `/app/data`;
- automatic daily Fly volume snapshots with 30-day retention;
- verified gzip ledger backups with SHA-256 manifests;
- independent restore verification that replays the ledger chain;
- webhook rate limiting with trusted-proxy support;
- overlapping webhook-secret rotation;
- a manual production deployment workflow gated through the GitHub `production` environment;
- GitHub App, deployment, operations, rollback, and incident runbooks.

## Validation commands

```bash
npm run check
npm test
npm run smoke
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
```

## Phase 1 validation record

The following targeted checks were executed against the Phase 1 changes on July 13, 2026:

- Nine targeted tests passed:
  - health status;
  - invalid-signature rejection;
  - previous-secret acceptance during controlled rotation;
  - rate-limit rejection with `Retry-After`;
  - verified backup creation and restore;
  - backup tamper rejection;
  - default hardening configuration;
  - explicit hardening configuration parsing;
  - invalid trusted-proxy setting rejection.
- JavaScript syntax validation passed for the modified application, configuration, test, and backup files.
- A two-record evidence ledger verified successfully.
- The ledger produced a compressed backup and manifest.
- The restored backup passed compressed SHA-256, source SHA-256, record-count, final-hash, and full chain verification.
- A deliberately modified compressed backup was rejected because its digest did not match the manifest.
- `fly.toml` parsed as valid TOML.
- `docker-compose.yml` parsed as valid YAML.

The original v0.1.0 source deployment separately recorded 17 passing local tests, syntax validation, a smoke test, and ledger verification before this hardening branch.

## Evidence format

Runtime evidence is written as newline-delimited JSON. Each record includes `previous_hash` and `record_hash`, creating a linear SHA-256 hash chain.

Application backup manifests include:

- source ledger digest;
- compressed backup digest;
- record count;
- final record hash;
- source and backup sizes;
- environment and region metadata.

## Limitations

- Phase 1 still uses a single active ledger file on one persistent volume. Fly snapshots and verified local backup artifacts materially improve recoverability, but external object-lock replication or a managed shared store remains Phase 2 work.
- The in-memory rate limiter is instance-local. Multi-instance deployment requires a shared rate-limit store or edge enforcement.
- Duplicate protection is process-local plus ledger-backed; clustered deployments need shared storage or a queue.
- The service does not scan file contents for secrets in v0.1; it blocks high-risk paths and should be paired with GitHub secret scanning.
- The service does not configure branch protection automatically.
- The Docker image and Fly deployment could not be executed in the current validation runtime because no Docker daemon was available and GitHub-hosted Actions execution remains restricted. Those checks are explicit first-deployment gates in the runbook.
- Production certification, penetration testing, load testing, multi-region failover, and independent security review are not yet complete.
