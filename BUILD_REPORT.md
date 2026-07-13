# Build Report — altmanai-ci-server v0.2.0

**Audit date:** 2026-07-13
**Runtime validated:** Node.js `v22.16.0`
**Authorization record:** `ALTMANAI-CI-VERIFY-2026-07-13-001`
**Authorizing human:** Blake Hunter Altman
**AI execution partner:** AltmanAI Model 2.0

## Validation completed

- `npm ci --ignore-scripts --no-audit --no-fund` — passed
- `npm run check` — passed
- `npm test` — **38 passed, 0 failed**
- `npm run smoke` — passed; `/healthz` returned HTTP 200 and version `0.2.0`
- `npm run verify-ledger` — passed; empty ledger valid
- `npm pack --dry-run` — passed; 41-file package manifest generated

## Corrections made during the audit

- Removed the stale hard-coded commit reference from the prior report.
- Replaced third-party Actions dependencies with first-party shell checkout and pinned Node 22 container execution.
- Bound Founder approval to both GitHub login and immutable user ID.
- Added startup schema validation for policy and verification records.
- Added SHA-256 verification of the exact authorization statement.
- Made GitHub App credentials the production default and static tokens explicit opt-in only.
- Added GitHub API retry, timeout, token-cache, response-parse, and fail-closed pagination controls.
- Serialized ledger verification behind pending writes.
- Added verified identity metadata to evidence records and service status.

## Container validation

The production Dockerfile is pinned to `node:22.16.0-alpine`, installs from `package-lock.json`, runs as a non-root user, and defines an HTTP health check. The GitHub workflow performs an actual Docker image build because this local execution environment does not provide a Docker daemon.

## Accuracy boundary

No engineering process can honestly guarantee that software is universally error-free under every future environment or attack. This report records the deterministic checks actually executed and passed. Independent security testing and a live staging deployment remain required before production certification.
