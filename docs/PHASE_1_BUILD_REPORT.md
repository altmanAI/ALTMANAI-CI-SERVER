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
- explicit rate-limit response headers and `Retry-After`
- validated ingress configuration bounds
- hardened non-root container metadata and filesystem paths
- Fly.io persistent evidence volume
- daily Fly Volume snapshots with 30-day retention
- bounded automatic volume growth
- health and full-ledger readiness checks
- hardened Docker Compose reference
- exact copied-snapshot ledger verification before retention
- collision-resistant backup naming
- SHA-256 backup manifest with record count and final chain hash
- backup retention pruning
- corruption and partial-snapshot refusal
- production GitHub App setup and rotation procedure
- human-gated Fly.io production deployment workflow
- immutable commit pins for every GitHub Action
- reviewed hard-coded `flyctl` version
- staged rollout and branch-protection checklist

## Executed validation

Executed with Node.js `v22.16.0` against the exact changed runtime, backup, configuration, and test files fetched from the GitHub branch:

- JavaScript syntax validation for the reconstructed changed executable surface — passed
- `node --test test/app.test.mjs test/backup-ledger.test.mjs test/config.test.mjs` — **17 passed, 0 failed**
- signed webhook delivery — passed
- invalid webhook signature rejection — passed
- missing GitHub delivery-header rejection — passed
- abusive burst returned HTTP 429 with retry metadata — passed
- trusted Fly client-address bucket separation — passed
- safe ingress defaults and explicit overrides — passed
- invalid rate-limit and trusted-proxy configuration rejection — passed
- exact retained backup bytes replayed as a valid hash chain — passed
- paired backup manifest SHA-256 comparison — passed
- collision-resistant repeated backup names — passed
- tampered-ledger snapshot refusal — passed
- `fly.toml` parsed as TOML with mount, snapshot, and two health-check assertions — passed
- `compose.yaml` parsed as YAML with read-only and service assertions — passed
- deployment workflow parsed as YAML — passed
- all deployment action references asserted as immutable 40-character commit pins — passed
- official action definitions were resolved at the pinned revisions for checkout, Node setup, and Fly setup — passed

## Existing base-release evidence

The unchanged v0.2.0 base release previously completed:

- 38 automated tests, 0 failures
- syntax validation
- smoke test
- ledger verification
- package dry run
- 91.59% line coverage

## Validation limitations

The local execution environment could not resolve GitHub from its shell, so it could not clone and execute the entire branch as one checkout. The changed executable components were reconstructed from the exact authenticated GitHub branch contents and tested directly.

A Docker daemon and `flyctl` runtime were not available locally. Therefore:

- the production image was reviewed structurally but not built in this environment;
- `fly config validate` and a live Fly deployment were not executed;
- the complete repository suite, container build, and deployed health checks remain mandatory steps in `.github/workflows/deploy-fly.yml` before production deployment.

GitHub-hosted runners remain subject to the previously recorded account-level pre-step execution restriction. No claim is made that the new deployment workflow has run successfully on GitHub.

## Deployment status

This report validates the Phase 1 package for pull-request review. It does not certify a live Fly.io deployment, GitHub App installation, branch-protection activation, snapshot recovery drill, penetration test, or production authorization.
