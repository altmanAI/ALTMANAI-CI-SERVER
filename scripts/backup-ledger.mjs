import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function removeExpiredBackups(directory, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('evidence-'))
    .map(async (entry) => {
      const match = entry.name.match(/^evidence-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      if (!match) return;
      const created = Date.parse(match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3') + 'Z');
      if (Number.isFinite(created) && created < cutoff) {
        await rm(join(directory, entry.name), { force: true });
      }
    }));
}

const ledgerPath = resolve(process.env.EVIDENCE_LEDGER_PATH || './data/evidence.ndjson');
const backupDir = resolve(process.env.EVIDENCE_BACKUP_DIR || './data/backups');
const retentionDays = Number(process.env.LEDGER_BACKUP_RETENTION_DAYS || 30);

if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
  throw new Error('LEDGER_BACKUP_RETENTION_DAYS must be a positive integer');
}

const ledger = new EvidenceLedger(ledgerPath);
const verification = await ledger.verify();
if (!verification.valid) {
  throw new Error(`Refusing backup: ledger verification failed (${verification.reason})`);
}

await mkdir(backupDir, { recursive: true, mode: 0o700 });
const source = await readFile(ledgerPath).catch((error) => {
  if (error.code === 'ENOENT') return Buffer.from('');
  throw error;
});
const compressed = gzipSync(source, { level: 9 });
const timestamp = safeTimestamp();
const backupName = `evidence-${timestamp}.ndjson.gz`;
const manifestName = `evidence-${timestamp}.manifest.json`;
const backupPath = join(backupDir, backupName);
const manifestPath = join(backupDir, manifestName);
const temporaryBackup = `${backupPath}.tmp`;
const temporaryManifest = `${manifestPath}.tmp`;

const manifest = {
  schema_version: '1.0',
  created_at: new Date().toISOString(),
  service: process.env.SERVICE_NAME || 'altmanai-ci-server',
  environment: process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
  region: process.env.DEPLOYMENT_REGION || null,
  source_file: basename(ledgerPath),
  source_bytes: source.length,
  source_sha256: sha256(source),
  records: verification.records,
  last_record_hash: verification.lastHash,
  backup_file: backupName,
  backup_bytes: compressed.length,
  backup_sha256: sha256(compressed)
};

await writeFile(temporaryBackup, compressed, { mode: 0o600 });
await rename(temporaryBackup, backupPath);
await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await rename(temporaryManifest, manifestPath);
await removeExpiredBackups(backupDir, retentionDays);

console.log(JSON.stringify({ status: 'backup_complete', backupPath, manifestPath, ...manifest }));
