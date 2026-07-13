# Phase 1 Production Deployment

**Objective:** operate one hardened, monitored instance that protects `ALTMANAI-CI-SERVER` first and one additional repository only after self-governance validation.

This is a controlled initial deployment, not a claim of full production certification.

## Deployment artifacts

| Artifact | Purpose |
|---|---|
| `Dockerfile` | non-root Node.js 22 runtime with `tini`, readiness healthcheck, and fixed writable data path |
| `docker-compose.yml` | hardened single-host deployment and local production rehearsal |
| `fly.toml` | Fly.io service, encrypted volume, daily snapshots, health checks, capacity, and HTTPS configuration |
| `.env.example` | production variable and secret contract |
| `scripts/backup-ledger.mjs` | verifies the chain before producing a compressed backup and SHA-256 manifest |
| `.github/workflows/deploy-fly.yml` | manual, human-gated deployment pipeline staged for use after GitHub-hosted Actions are restored |
| `docs/GITHUB_APP_PRODUCTION.md` | least-privilege GitHub App setup and credential rotation |

## Production invariants

Do not deploy unless all are true:

- GitHub App authentication is configured; `GITHUB_TOKEN` is blank.
- `WEBHOOK_SECRET`, `GITHUB_APP_ID`, and `GITHUB_PRIVATE_KEY` exist only in the platform secret manager.
- `/app/data` is a persistent encrypted volume.
- HTTPS is forced at the edge.
- `/readyz` is the deployment health check.
- automatic daily volume snapshots are enabled.
- the evidence chain verifies before branch protection is enabled.
- the App is installed only on the initial rollout repositories.

# Fly.io — recommended Phase 1 path

## 1. Install and authenticate flyctl

Install `flyctl` using Fly.io's official instructions, then authenticate:

```bash
fly auth login
```

## 2. Review the application identity

The committed configuration uses:

```text
app: altmanai-ci-server
region: iad
volume: altmanai_ci_data
```

If the app name is unavailable, change the `app` value in `fly.toml` and use that name consistently in the commands below. `iad` is selected as the initial East Coast region.

## 3. Create the Fly application

```bash
fly apps create altmanai-ci-server
```

Do not deploy yet.

## 4. Create the persistent volume

```bash
fly volumes create altmanai_ci_data \
  --app altmanai-ci-server \
  --region iad \
  --size 1 \
  --snapshot-retention 30
```

The committed `fly.toml` keeps scheduled daily snapshots enabled and mounts the volume at `/app/data`.

## 5. Configure production secrets

Complete the GitHub App registration first, then run:

```bash
fly secrets set \
  WEBHOOK_SECRET='<webhook-secret>' \
  GITHUB_APP_ID='<app-id>' \
  GITHUB_PRIVATE_KEY="$(cat /secure/path/github-app-private-key.pem)" \
  FOUNDER_GITHUB_LOGIN='altmanAI' \
  ALLOWED_GITHUB_OWNER='altmanAI' \
  --app altmanai-ci-server
```

Confirm that no personal access token is stored:

```bash
fly secrets list --app altmanai-ci-server
```

The command lists secret names and digests, not plaintext values.

## 6. Validate locally before first deployment

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run smoke
npm run verify-ledger

docker build -t altmanai-ci-server:phase1 .
docker compose config
docker compose up --build -d
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/readyz
docker compose down
```

## 7. Deploy

```bash
fly deploy --app altmanai-ci-server --strategy rolling
```

The service is configured to keep one Machine running continuously because webhook cold starts create avoidable delivery risk.

## 8. Verify the live service

```bash
fly status --app altmanai-ci-server
fly checks list --app altmanai-ci-server
fly logs --app altmanai-ci-server
curl --fail https://altmanai-ci-server.fly.dev/healthz
curl --fail https://altmanai-ci-server.fly.dev/readyz
curl --fail https://altmanai-ci-server.fly.dev/v1/status
```

Expected results:

- `/healthz`: HTTP 200
- `/readyz`: HTTP 200 and `ledger.valid: true`
- `/v1/status`: production environment and expected policy digest

## 9. Create and verify the first backup

```bash
fly ssh console \
  --app altmanai-ci-server \
  --command 'npm run backup-ledger'
```

Then inspect the backup directory:

```bash
fly ssh console \
  --app altmanai-ci-server \
  --command 'ls -lah /app/data/backups'
```

Each backup must have:

- a `.ndjson.gz` payload;
- a `.manifest.json` file;
- source and backup SHA-256 digests;
- record count and last ledger hash.

## 10. Confirm platform snapshots

```bash
fly volumes list --app altmanai-ci-server
fly volumes snapshots list <volume-id>
```

The Fly volume is configured for automatic daily snapshots with 30-day retention. Application-level backup files provide an additional evidence artifact inside the volume; they do not replace platform snapshots or future object-lock replication.

## 11. Connect GitHub and run the self-governance matrix

Follow `docs/GITHUB_APP_PRODUCTION.md`, then validate:

| Scenario | Expected result |
|---|---|
| GitHub `ping` delivery | HTTP 202 and ledger record |
| invalid HMAC | HTTP 401 and structured warning log |
| oversized body | HTTP 413 |
| rate-limit threshold exceeded | HTTP 429 with `Retry-After` |
| non-AltmanAI owner payload | HTTP 403 |
| routine compliant PR | governance check completes according to policy |
| material PR without Founder phrase | check fails |
| exact phrase from wrong account | check fails |
| exact standalone phrase from configured Founder account | check passes if all other requirements pass |
| duplicate delivery ID | accepted as duplicate without duplicate decision execution |
| ledger tampering simulation in staging | readiness fails and service refuses trusted operation |

Do not run destructive tampering tests against the production ledger.

## 12. Enable branch protection

After the complete matrix passes, require `AltmanAI Governance Gate` on `main` for `ALTMANAI-CI-SERVER`. Keep the App installation and required check limited to this repository until at least several real pull requests complete successfully.

## 13. Configure monitoring

Use an external uptime monitor with checks against:

- `GET /healthz` every 60 seconds;
- `GET /readyz` every 60 seconds.

Alert immediately on:

- two consecutive readiness failures;
- any sustained 5xx rate;
- repeated webhook-signature rejection beyond expected noise;
- GitHub API 401, 403, or 429 responses;
- ledger verification failure;
- backup job failure;
- volume usage above 70 percent.

# Railway — strong alternative

Use Railway only when the deployment includes a persistent volume and explicit backups.

1. Create a new Railway project from the GitHub repository.
2. Confirm Railway builds the committed `Dockerfile`.
3. Add a persistent volume mounted at `/app/data`.
4. Add every non-secret variable from `.env.example`.
5. Add `WEBHOOK_SECRET`, `GITHUB_APP_ID`, and `GITHUB_PRIVATE_KEY` as Railway secrets.
6. Leave `GITHUB_TOKEN` unset.
7. Configure the service health check to `/readyz`.
8. Generate the public HTTPS domain and use `/webhooks/github` as the GitHub App webhook URL.
9. Set restart behavior to restart on failure.
10. Run the same self-governance matrix before enabling branch protection.
11. Enable Railway volume backups or an external backup process; a mounted volume without recoverable snapshots is insufficient.

# Rollback

If a deployment fails readiness or webhook validation:

1. remove the required branch-protection check temporarily only if necessary to restore repository access;
2. disable the GitHub App webhook or uninstall it from protected repositories;
3. deploy the previous known-good image or commit;
4. verify the ledger before accepting new deliveries;
5. restore the volume from a known-good snapshot if integrity failed;
6. document the incident and correction before re-enabling enforcement.

Never replace a failed ledger with an empty file to make readiness pass.

# Phase 1 exit criteria

Phase 1 is complete only when:

- the service has operated continuously for at least seven days;
- all self-governance scenarios have documented outcomes;
- daily volume snapshots are visible;
- at least one application-level ledger backup has been restored and verified in staging;
- no unexplained signature, authentication, or ledger-integrity failures remain;
- branch protection requires the governance check on the CI server repository;
- a human-approved decision authorizes adding the second protected repository.
