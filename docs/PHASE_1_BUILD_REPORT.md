# Phase 1 Hardening Build Report

**Date:** 2026-07-13  
**Base release:** `79863a46f3dbefb57854ab94a12e7ca8346bfb17` (`v0.2.0`)  
**Branch:** `agent/phase-1-production-hardening`  
**Authorizing human:** Blake Hunter Altman  
**AI execution partner:** AltmanAI Model 2.0

## Implemented controls

- configurable webhook request-rate limit
- trusted-proxy client address handling that is disabled by default
- structured logging for signature rejection and rate-limit rejection
- explicit rate-limit response headers
- hardened non-root container metadata and filesystem paths
- Fly.io persistent evidence volume
- daily Fly Volume snapshots with 30-day retention
- bounded automatic volume growth
- health and full-ledger readiness checks
- hardened Docker Compose reference
- atomic verified ledger backup command
- SHA-256 backup manifest
- backup retention pruning
- corruption refusal before backup
- production GitHub App setup and rotation procedure
- human-gated Fly.io production deployment workflow
- staged rollout and branch-protection checklist

## Executed validation

Executed with Node.js `v22.16.0` against the changed runtime modules:

- `node --check src/app.mjs` — passed
- `node --check scripts/backup-ledger.mjs` — passed
- targeted webhook tests — 3 passed, 0 failed
- targeted evidence-backup tests — 2 passed, 0 failed
- signed webhook delivery — passed
- abusive burst returned HTTP 429 — passed
- trusted Fly client-address bucket separation — passed
- two-record evidence ledger verification — passed
- timestamped backup creation — passed
- backup manifest SHA-256 comparison — passed
- tampered-ledger backup refusal — passed
- `fly.toml` parsed as TOML with mount and check assertions — passed
- `compose.yaml` parsed as YAML with hardening assertions — passed
- deployment workflow parsed as YAML with job assertions — passed

## Existing base-release evidence

The unchanged v0.2.0 base release previously completed:

- 38 automated tests, 0 failures
- syntax validation
- smoke test
- ledger verification
- package dry run
- 91.59% line coverage

## Validation limitation

The execution environment could not resolve `github.com` from its local shell, so it could not clone and execute the entire branch test suite as one checkout. Changed runtime and backup components were reconstructed from the exact committed branch contents and tested directly. The complete repository suite and container build remain mandatory gates in `.github/workflows/deploy-fly.yml` before production deployment.

GitHub-hosted runners also remain subject to the previously recorded account-level pre-step execution restriction. No claim is made that the new deployment workflow has run successfully on GitHub.

## Deployment status

This report validates the Phase 1 package for pull-request review. It does not certify a live Fly.io deployment, GitHub App installation, branch-protection activation, snapshot recovery drill, or production authorization.
