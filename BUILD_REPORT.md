# Build Report — altmanai-ci-server v0.1.0

**Build date:** 2026-07-13  
**Runtime validated:** Node.js v22.16.0  
**Repository commit lineage:** `4aacb61cf68140941b1c40f8277c30f0987cb505`

## Validation completed

- `npm run check` — passed
- `npm test` — 17 tests passed, 0 failed
- `npm run smoke` — passed; `/healthz` returned HTTP 200
- `npm run verify-ledger` — passed; empty ledger valid
- Git working tree — clean after final commit

## Tested controls

- GitHub HMAC-SHA256 webhook validation
- invalid-signature rejection
- production configuration enforcement
- exact Founder GitHub identity and standalone approval phrase
- protected and forbidden path policy
- AI-assistance disclosure requirement
- append-only SHA-256 evidence chain
- tamper detection
- serialized concurrent evidence writes
- in-flight webhook replay protection
- repository-owner allowlist
- mocked GitHub Check Run publication

## Validation limitation

A container image build was not executed in this environment because the Docker CLI/runtime was not installed. The Dockerfile was included and reviewed structurally, and the GitHub Actions workflow performs the container build in CI.
