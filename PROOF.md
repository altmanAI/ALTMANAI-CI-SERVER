# Proof

## Current verified capabilities

The v0.2.0 repository includes executable tests for:

- GitHub's documented HMAC-SHA256 webhook validation vector
- required GitHub event and delivery headers
- invalid webhook-signature rejection
- repository-backed Blake Hunter Altman × AltmanAI Model 2.0 verification data
- verification-statement SHA-256 validation at startup
- exact Founder login, immutable GitHub user ID, and standalone phrase enforcement
- credential-like file blocking
- exact Markdown PR-section detection
- case-insensitive AI-assistance disclosure
- production GitHub App authentication enforcement
- explicit opt-in before production static-token use
- GitHub API retry and non-JSON error handling
- fail-closed pagination limits
- hash-chain creation and tamper detection
- serialized concurrent evidence writes and verification
- webhook replay protection
- identity-bound evidence records
- health, status, verification, and smoke-test behavior

## Validation commands

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger
npm pack --dry-run
```

The July 13, 2026 audit completed **38 tests with 38 passes and 0 failures** on Node.js `v22.16.0`.

## Authorization proof

The exact Blake Hunter Altman verification statement and its SHA-256 digest are recorded in [`VERIFICATION.md`](VERIFICATION.md) and [`config/verification.json`](config/verification.json). The runtime validates that digest during startup and exposes the non-secret record at `GET /v1/verification`.

## Evidence format

Runtime evidence is written as newline-delimited JSON. Each record includes `previous_hash` and `record_hash`, creating a linear SHA-256 hash chain. Governance decisions also record the authorizing human, immutable GitHub user ID, AI execution partner, and authorization record ID.

## Limitations

- The local ledger is only as durable as its storage volume.
- Duplicate protection is process-local plus ledger-backed; clustered deployments need shared storage or a queue.
- The service does not scan complete file contents for secrets; it blocks high-risk paths and must be paired with GitHub secret scanning and push protection.
- The service does not configure branch protection automatically.
- Independent penetration testing and production certification remain separate activities.
