# Architecture

## Components

### HTTP ingress

A Node.js `http` server exposes health, readiness, status, and GitHub webhook routes. The webhook route reads a bounded raw body and validates `X-Hub-Signature-256` before parsing JSON.

### GitHub authentication

Production uses a GitHub App private key to create an app JWT and exchange it for a short-lived installation token tied to the webhook's `installation.id`.

### Policy engine

The deterministic policy engine evaluates:

- changed-file count
- protected and forbidden paths
- required PR sections
- AI-assistance disclosure
- exact Founder authorization

### Check publisher

The server creates a completed GitHub Check Run against the pull request head SHA. The check summary is intended for branch-protection enforcement.

### Evidence ledger

Every accepted, ignored, successful, or failed decision is serialized to NDJSON and chained to the prior record with SHA-256.

## Trust boundaries

1. Public internet to webhook ingress
2. Webhook ingress to verified GitHub event
3. Service to GitHub REST API
4. Service to evidence storage
5. Human GitHub identity to Founder approval decision

## Scale path

For multi-instance production deployment:

- place a queue after signature verification
- use shared durable storage for delivery idempotency and evidence
- add distributed tracing
- use object-lock storage for evidence retention
- introduce installation-token caching with expiry
- add replay and dead-letter workflows
