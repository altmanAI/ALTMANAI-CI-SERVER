# Deployment

## Minimum production platform

- managed HTTPS ingress
- secret manager
- persistent encrypted volume or external evidence store
- log aggregation with redaction controls
- container runtime supporting non-root execution
- outbound HTTPS access to `api.github.com`

## Required secrets

- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `FOUNDER_GITHUB_LOGIN`
- `ALLOWED_GITHUB_OWNER`

## Recommended rollout

1. Deploy to a private staging environment.
2. Register a staging GitHub App on one test repository.
3. Confirm signature validation with a GitHub `ping` event.
4. Open test PRs that exercise pass and fail decisions.
5. Confirm that branch protection requires `AltmanAI Governance Gate`.
6. Verify the ledger after every scenario.
7. Perform a credential-leak and webhook-replay review.
8. Promote only after Founder authorization.

## Cloud Run example

The container is compatible with any platform that provides HTTPS and environment secrets. For Google Cloud Run, mount secrets as environment variables, configure a persistent external evidence sink, and restrict unauthenticated traffic to the webhook route through the platform's ingress controls.

## Observability

Alert on:

- readiness failure
- GitHub API 401/403/429 responses
- webhook signature failures above baseline
- ledger verification failure
- sustained 5xx responses
- event-processing latency

## Backup and retention

The local ledger path is suitable for development only. Production should replicate evidence to retention-controlled storage and regularly verify the hash chain from an independent job.
