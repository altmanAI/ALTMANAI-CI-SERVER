# Operations Runbook

## Service objectives for Phase 1

- one continuously running instance;
- webhook requests accepted only after HMAC validation;
- durable ledger on an encrypted persistent volume;
- daily platform snapshots;
- verified application-level ledger backup artifacts;
- fast human escalation for authentication, integrity, or availability failures.

These are initial operating targets, not a formal service-level agreement.

## Routine checks

### Daily

```bash
curl --fail https://altmanai-ci-server.fly.dev/healthz
curl --fail https://altmanai-ci-server.fly.dev/readyz
fly checks list --app altmanai-ci-server
fly logs --app altmanai-ci-server
```

Review logs for:

- `Webhook signature rejected`
- `Webhook rate limit exceeded`
- `Request failed`
- GitHub API 401, 403, or 429 responses
- ledger verification errors
- uncaught exceptions or unhandled rejections

### Daily evidence backup

```bash
fly ssh console \
  --app altmanai-ci-server \
  --command 'npm run backup-ledger && npm run verify-backup'
```

The backup command refuses to snapshot an invalid ledger. The verification command decompresses the backup into an isolated temporary directory, verifies both SHA-256 digests, replays the hash chain, and confirms record count plus final hash.

### Weekly

```bash
fly volumes list --app altmanai-ci-server
fly volumes snapshots list <volume-id>
```

Confirm:

- snapshots are recent;
- volume usage is below 70 percent;
- the service has not restarted unexpectedly;
- the GitHub App remains installed only on approved repositories;
- no unused GitHub App private keys remain active.

### Monthly

- restore the latest volume snapshot to a staging volume;
- run `npm run verify-ledger` against the restored ledger;
- verify one compressed application backup with `npm run verify-backup`;
- review webhook-secret and private-key age;
- review GitHub App permissions and repository installation scope;
- review rate-limit thresholds against actual delivery volume;
- document the review in the decision log.

## Backup artifacts

A successful backup produces:

```text
/app/data/backups/evidence-<timestamp>.ndjson.gz
/app/data/backups/evidence-<timestamp>.manifest.json
```

The manifest includes:

- source ledger SHA-256;
- compressed backup SHA-256;
- source and backup sizes;
- ledger record count;
- final record hash;
- environment and region metadata.

Local application backups are retained according to `LEDGER_BACKUP_RETENTION_DAYS`. Fly volume snapshots are controlled independently through `fly.toml`.

## Restore drill

Never overwrite the production ledger during a drill.

1. Restore a Fly volume snapshot into a new staging volume.
2. Attach the restored volume to a staging Machine or copy the ledger to an isolated environment.
3. Set `EVIDENCE_LEDGER_PATH` to the restored file.
4. Run:

```bash
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
```

5. Confirm the record count and final hash match the expected production backup manifest.
6. Destroy the staging copy after the drill unless retention is explicitly authorized.

## Severity model

### SEV-1 — integrity or authority compromise

Examples:

- ledger verification failure;
- suspected private-key or webhook-secret disclosure;
- unauthorized check publication;
- governance check passes without the required human authorization;
- evidence records disappear or are rewritten.

Immediate actions:

1. disable the GitHub App webhook or uninstall the App from protected repositories;
2. suspend required-check enforcement only as needed to prevent repository lockout;
3. preserve logs, delivery IDs, snapshots, manifests, and current ledger bytes;
4. rotate affected credentials;
5. restore only from a verified snapshot;
6. do not resume enforcement until a human approves the recovery evidence.

### SEV-2 — sustained availability failure

Examples:

- `/readyz` fails for more than five minutes;
- repeated GitHub API authentication failures;
- deployment cannot publish checks;
- persistent 5xx responses.

Actions:

1. stop new deployments;
2. inspect Fly checks and logs;
3. verify the ledger independently;
4. deploy the previous known-good image if ledger integrity is intact;
5. disable the webhook if failed deliveries create unsafe ambiguity.

### SEV-3 — degraded operation

Examples:

- elevated invalid signatures;
- rate limiting triggers during legitimate GitHub delivery bursts;
- backup job fails while the primary ledger remains healthy;
- volume usage exceeds 70 percent.

Actions:

1. investigate within the same operating day;
2. preserve evidence and delivery identifiers;
3. adjust thresholds only through a reviewed change;
4. do not suppress alerts without documenting the reason.

## Credential rotation

Follow `docs/GITHUB_APP_PRODUCTION.md`.

Never rotate a webhook secret by replacing the only accepted secret before the GitHub configuration is ready. Use `WEBHOOK_SECRET_PREVIOUS` for controlled overlap, verify a real delivery, then remove the old secret.

## Safe shutdown and deployment

The container uses `tini`, runs as UID/GID `10001`, and receives `SIGTERM`. The service stops accepting new connections and has a bounded shutdown window.

Before deployment:

```bash
npm run check
npm test
npm run backup-ledger
npm run verify-backup
```

After deployment:

```bash
curl --fail https://altmanai-ci-server.fly.dev/readyz
fly checks list --app altmanai-ci-server
```

## Forbidden recovery shortcuts

Never:

- delete or truncate `evidence.ndjson` to make readiness pass;
- disable HMAC verification;
- switch production to a personal access token without an incident decision;
- weaken the Founder identity or exact-phrase rule to clear a blocked pull request;
- commit a private key, webhook secret, Fly token, or restored production ledger;
- claim a failed or skipped validation passed.
