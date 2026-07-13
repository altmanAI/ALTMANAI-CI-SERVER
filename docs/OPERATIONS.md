# Operations Runbook

## Phase 1 operating objectives

- one continuously running instance;
- HMAC-verified webhook processing;
- durable ledger on persistent encrypted storage;
- daily platform snapshots;
- verified application-level backup artifacts;
- fast human escalation for authority, integrity, or availability failures.

These are operating targets, not a formal service-level agreement.

## Daily checks

```bash
curl --fail https://altmanai-ci-server.fly.dev/healthz
curl --fail https://altmanai-ci-server.fly.dev/readyz
fly checks list --app altmanai-ci-server
fly logs --app altmanai-ci-server
```

Review structured logs for:

- `Webhook signature rejected`;
- `Webhook rate limit exceeded`;
- `Request failed`;
- GitHub API 401, 403, or 429 responses;
- ledger verification errors;
- uncaught exceptions or unhandled rejections.

## Daily evidence backup

```bash
fly ssh console \
  --app altmanai-ci-server \
  --command 'npm run backup-ledger && npm run verify-backup'
```

The backup command refuses to snapshot an invalid chain. Verification independently checks compressed and source digests, restores into an isolated temporary path, replays the chain, and confirms record count plus final hash.

## Weekly checks

```bash
fly volumes list --app altmanai-ci-server
fly volumes snapshots list <volume-id>
```

Confirm:

- snapshots are current;
- volume usage is below 70 percent;
- the service has not restarted unexpectedly;
- the GitHub App remains installed only on approved repositories;
- unused GitHub App keys have been deleted.

## Monthly restore drill

Never overwrite the production ledger during a drill.

1. Restore the latest platform snapshot into a staging volume.
2. Attach the volume to an isolated staging Machine.
3. Set `EVIDENCE_LEDGER_PATH` to the restored file.
4. Run:

```bash
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
```

5. Confirm record count and final hash against the expected manifest.
6. Destroy the staging copy unless continued retention is explicitly authorized.
7. Record the drill result in the decision log.

## Backup artifacts

A successful application backup produces:

```text
/app/data/backups/evidence-<timestamp>.ndjson.gz
/app/data/backups/evidence-<timestamp>.manifest.json
```

The manifest records:

- source ledger SHA-256;
- compressed backup SHA-256;
- source and backup sizes;
- ledger record count;
- final record hash;
- environment and region metadata.

Application backup retention is controlled by `LEDGER_BACKUP_RETENTION_DAYS`. Platform snapshot retention is controlled independently in `fly.toml`.

## Severity model

### SEV-1 — authority or evidence integrity compromise

Examples:

- ledger verification failure;
- suspected private-key or webhook-secret disclosure;
- unauthorized check publication;
- governance check passes without required identity-bound authorization;
- evidence records disappear or are rewritten.

Immediate actions:

1. disable the GitHub App webhook or uninstall the App from protected repositories;
2. suspend the required check only as needed to prevent repository lockout;
3. preserve logs, delivery IDs, snapshots, manifests, and ledger bytes;
4. rotate affected credentials;
5. restore only from a verified snapshot;
6. resume enforcement only after human approval of the recovery evidence.

### SEV-2 — sustained availability failure

Examples:

- `/readyz` fails for more than five minutes;
- repeated GitHub App authentication failures;
- the service cannot publish checks;
- sustained 5xx responses.

Actions:

1. stop new deployments;
2. inspect platform checks and logs;
3. verify the ledger independently;
4. deploy the previous known-good revision if integrity is intact;
5. disable the webhook if failed deliveries create unsafe ambiguity.

### SEV-3 — degraded operation

Examples:

- elevated invalid signatures;
- legitimate delivery bursts trigger rate limiting;
- backup job fails while the primary ledger remains healthy;
- volume usage exceeds 70 percent.

Actions:

1. investigate within the same operating day;
2. preserve relevant evidence and delivery identifiers;
3. adjust thresholds only through reviewed changes;
4. never suppress alerts without documenting the reason.

## Safe deployment

Before deployment:

```bash
npm run check
npm test
npm run smoke
npm run verify-ledger
npm run backup-ledger
npm run verify-backup
```

After deployment:

```bash
curl --fail https://altmanai-ci-server.fly.dev/readyz
curl --fail https://altmanai-ci-server.fly.dev/v1/verification
fly checks list --app altmanai-ci-server
```

## Credential rotation

Follow `docs/GITHUB_APP_PRODUCTION.md`.

Never replace the only accepted webhook secret before GitHub is ready. Use `WEBHOOK_SECRET_PREVIOUS` for controlled overlap, verify a real delivery, and then remove the old value.

## Forbidden recovery shortcuts

Never:

- delete or truncate `evidence.ndjson` to make readiness pass;
- disable HMAC verification;
- weaken the immutable Founder login or user-ID requirement;
- switch production to a static token without a documented incident decision;
- commit a private key, webhook secret, Fly token, or restored production ledger;
- claim a failed, skipped, or unavailable validation passed.
