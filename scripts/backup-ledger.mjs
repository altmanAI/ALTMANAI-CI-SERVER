import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function readLedger(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return Buffer.alloc(0);
    throw error;
  }
}

async function atomicWrite(path, content) {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, content, { mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function pruneExpiredBackups(directory, retentionDays, now = Date.now()) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^evidence-\d{4}-\d{2}-\d{2}T.*\.(ndjson|manifest\.json)$/.test(entry.name)) continue;
    const path = join(directory, entry.name);
    const metadata = await stat(path);
    if (metadata.mtimeMs < cutoff) {
      await rm(path);
      removed += 1;
    }
  }
  return removed;
}

const ledgerPath = resolve(process.env.EVIDENCE_LEDGER_PATH || './data/evidence.ndjson');
const backupDirectory = resolve(process.env.EVIDENCE_BACKUP_DIR || './data/backups');
const retentionDays = positiveInteger(
  process.env.EVIDENCE_BACKUP_RETENTION_DAYS,
  30,
  'EVIDENCE_BACKUP_RETENTION_DAYS'
);

await mkdir(backupDirectory, { recursive: true, mode: 0o700 });

// Read the live file exactly once. The copied bytes—not a later read of the
// source—are what this command verifies, hashes, and retains.
const content = await readLedger(ledgerPath);
const createdAt = new Date().toISOString();
const safeTimestamp = createdAt.replace(/[:.]/g, '-');
const stem = `evidence-${safeTimestamp}-${randomUUID()}`;
const stagedSnapshotPath = join(backupDirectory, `.${stem}.snapshot.tmp`);
const backupPath = join(backupDirectory, `${stem}.ndjson`);
const manifestPath = join(backupDirectory, `${stem}.manifest.json`);

let backupCommitted = false;
try {
  await writeFile(stagedSnapshotPath, content, { mode: 0o600, flag: 'wx' });

  const verification = await new EvidenceLedger(stagedSnapshotPath).verify();
  if (!verification.valid) {
    throw new Error(`Refusing to back up an invalid evidence ledger snapshot: ${verification.reason}`);
  }

  const contentSha256 = createHash('sha256').update(content).digest('hex');
  const manifest = {
    schema_version: '1.1',
    created_at: createdAt,
    source_file: basename(ledgerPath),
    backup_file: basename(backupPath),
    bytes: content.length,
    content_sha256: contentSha256,
    ledger_verification: verification,
    retention_days: retentionDays
  };

  await rename(stagedSnapshotPath, backupPath);
  backupCommitted = true;
  await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const removedFiles = await pruneExpiredBackups(backupDirectory, retentionDays);

  console.log(JSON.stringify({
    status: 'backup_created',
    backupPath,
    manifestPath,
    removedFiles,
    ...manifest
  }, null, 2));
} catch (error) {
  if (backupCommitted) await rm(backupPath, { force: true });
  throw error;
} finally {
  await rm(stagedSnapshotPath, { force: true });
}
