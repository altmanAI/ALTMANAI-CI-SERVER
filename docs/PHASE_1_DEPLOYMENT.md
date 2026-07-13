# Phase 1 Production Deployment

**Objective:** operate one hardened, monitored instance that protects `ALTMANAI-CI-SERVER` first and one additional repository only after documented self-governance validation.

This package is deployment-ready infrastructure. It is not evidence that a live production deployment has already occurred.

## Included artifacts

| Artifact | Purpose |
|---|---|
| `Dockerfile` | pinned Node 22.16 runtime, non-root UID/GID, `tini`, readiness healthcheck |
| `docker-compose.yml` | hardened local or single-host deployment with persistent data |
| `fly.toml` | Fly.io HTTPS service, volume, snapshots, health checks, and capacity limits |
| `.env.example` | production variables and secret contract |
| `scripts/backup-ledger.mjs` | chain verification, gzip backup, SHA-256 manifest, retention |
| `scripts/verify-backup.mjs` | isolated restore and full chain verification |
| `.github/workflows/deploy-fly.yml` | manual, environment-gated deployment workflow |
| `docs/GITHUB_APP_PRODUCTION.md` | GitHub App installation and credential rotation |
| `docs/OPERATIONS.md` | monitoring, backup, restore, incident, and rollback procedures |

## Production invariants

Do not enable repository enforcement unless all are true:

- production uses a GitHub App; `GITHUB_TOKEN` is unset;
- private keys and webhook secrets exist only in secret managers;
- `/app/data` is persistent encrypted storage;
- HTTPS is forced at the edge;
- `/readyz` is the platform health check;
- daily platform snapshots are enabled;
- the active ledger and at least one backup both verify;
- `/v1/verification` matches the repository-backed authorization record;
- the App is installed only on approved rollout repositories.

# Fly.io — recommended Phase 1 path

## 1. Authenticate

Install `flyctl` from Fly.io's official distribution and run:

```bash
fly auth login
```

## 2. Confirm app identity

The committed configuration uses:

```text
app: altmanai-ci-server
region: iad
volume: altmanai_ci_data
```

If the app name is unavailable, change `app` in `fly.toml` and use the replacement consistently.

## 3. Create the app and volume

```bash
fly apps create altmanai-ci-server

fly volumes create altmanai_ci_data \
  --app altmanai-ci-server \
  --region iad \
  --size 1 \
  --snapshot-retention 30
```

The committed configuration mounts this volume at `/app/data` and enables scheduled snapshots.

## 4. Configure secrets

Complete `docs/GITHUB_APP_PRODUCTION.md`, then run:

```bash
fly secrets set \
  WEBHOOK_SECRET='<webhook-secret>' \
  GITHUB_APP_ID='<app-id>' \
  GITHUB_PRIVATE_KEY="$(cat /secure/path/github-app-private-key.pem)" \
  FOUNDER_NAME='Blake Hunter Altman' \
  FOUNDER_GITHUB_LOGIN='altmanAI' \
  FOUNDER_GITHUB_USER_ID='233472124' \
  ALLOWED_GITHUB_OWNER='altmanAI' \
  --app altmanai-ci-server
```

Verify secret names without exposing values:

```bash
fly secrets list --app altmanai-ci-server
```

## 5. Rehearse locally

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger

docker build -t altmanai-ci-server:0.2.0 .
docker compose config
docker compose up --build -d
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/readyz
curl --fail http://127.0.0.1:8080/v1/verification
docker compose down
```

## 6. Deploy

```bash
fly deploy --app altmanai-ci-server --strategy rolling
```

The Phase 1 configuration keeps one Machine running to avoid webhook cold-start risk.

## 7. Verify live behavior

```bash
fly status --app altmanai-ci-server
fly checks list --app altmanai-ci-server
fly logs --app altmanai-ci-server

curl --fail https://altmanai-ci-server.fly.dev/healthz
curl --fail https://altmanai-ci-server.fly.dev/readyz
curl --fail https://altmanai-ci-server.fly.dev/v1/status
curl --fail https://altmanai-ci-server.fly.dev/v1/verification
```

Expected results:

- `/healthz`: HTTP 200 and version `0.2.0`;
- `/readyz`: HTTP 200 and `ledger.valid: true`;
- `/v1/status`: expected policy and authorization metadata;
- `/v1/verification`: repository-backed verification record.

## 8. Create and verify the first backup

```bash
fly ssh console \
  --app altmanai-ci-server \
  --command 'npm run backup-ledger && npm run verify-backup'

fly ssh console \
  --app altmanai-ci-server \
  --command 'ls -lah /app/data/backups'
```

Each backup must include a compressed ledger and a manifest containing both digests, record count, and final chain hash.

## 9. Confirm snapshots

```bash
fly volumes list --app altmanai-ci-server
fly volumes snapshots list <volume-id>
```

Platform snapshots and application backup artifacts are separate controls. Neither replaces Phase 2 external object-lock replication.

## 10. Run the self-governance matrix

| Scenario | Expected result |
|---|---|
| GitHub `ping` | HTTP 202 and evidence record |
| missing delivery headers | HTTP 400 |
| invalid HMAC | HTTP 401 and structured warning |
| oversized body | HTTP 413 |
| rate limit exceeded | HTTP 429 with `Retry-After` |
| non-AltmanAI owner | HTTP 403 |
| routine compliant PR | deterministic policy result |
| material PR without Founder authorization | check fails |
| phrase from wrong login or user ID | check fails |
| exact standalone phrase from configured Founder identity | passes only if all other requirements pass |
| duplicate delivery ID | no duplicate decision execution |
| staged ledger tampering | verification fails and readiness becomes unhealthy |

Do not run destructive tampering tests against the production ledger.

## 11. Enable branch protection

After the complete matrix passes, require `AltmanAI Governance Gate` on `main` for `ALTMANAI-CI-SERVER`. Keep enforcement limited to this repository until at least seven days of stable operation and a successful restore drill.

## 12. Monitoring

Configure an independent uptime monitor:

- `GET /healthz` every 60 seconds;
- `GET /readyz` every 60 seconds.

Alert on:

- two consecutive readiness failures;
- sustained 5xx responses;
- repeated signature rejection above baseline;
- GitHub API 401, 403, or 429 responses;
- backup or ledger verification failure;
- volume usage above 70 percent.

# Railway — alternative

1. Create a Railway project from this repository.
2. Build the committed `Dockerfile`.
3. Mount a persistent volume at `/app/data`.
4. configure non-secret variables from `.env.example`;
5. store `WEBHOOK_SECRET`, `GITHUB_APP_ID`, and `GITHUB_PRIVATE_KEY` as secrets;
6. leave `GITHUB_TOKEN` unset;
7. use `/readyz` as the health check;
8. use the generated HTTPS domain plus `/webhooks/github` for the GitHub App;
9. configure volume backups or an external backup target;
10. run the same self-governance matrix before branch protection.

# Rollback

If deployment fails readiness or webhook validation:

1. disable the GitHub App webhook or uninstall it from protected repositories;
2. suspend the required check only if necessary to prevent repository lockout;
3. preserve logs, delivery IDs, snapshots, manifests, and current ledger bytes;
4. deploy the previous known-good image or revision;
5. verify the ledger before accepting new deliveries;
6. restore only from a verified snapshot if integrity failed;
7. document the incident and obtain human approval before resuming enforcement.

Never truncate or replace the ledger merely to make readiness pass.

# Phase 1 exit criteria

Phase 1 is complete only when:

- the service has operated continuously for at least seven days;
- every self-governance scenario has a documented outcome;
- daily volume snapshots are visible;
- one application backup has been restored and verified in staging;
- no unexplained authentication, signature, or ledger failures remain;
- branch protection requires the governance check on the CI server repository;
- a human-approved decision authorizes the second protected repository.
