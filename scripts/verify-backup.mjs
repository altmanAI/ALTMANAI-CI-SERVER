import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function latestManifest(directory) {
  const entries = (await readdir(directory))
    .filter((name) => name.endsWith('.manifest.json'))
    .sort()
    .reverse();
  if (!entries.length) throw new Error(`No backup manifests found in ${directory}`);
  return join(directory, entries[0]);
}

const backupDir = resolve(process.env.EVIDENCE_BACKUP_DIR || './data/backups');
const requestedManifest = process.argv[2] || process.env.BACKUP_MANIFEST_PATH;
const manifestPath = requestedManifest ? resolve(requestedManifest) : await latestManifest(backupDir);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const backupPath = resolve(dirname(manifestPath), basename(manifest.backup_file));
const compressed = await readFile(backupPath);

if (sha256(compressed) !== manifest.backup_sha256) {
  throw new Error('Backup SHA-256 does not match the manifest');
}

const source = gunzipSync(compressed);
if (sha256(source) !== manifest.source_sha256) {
  throw new Error('Decompressed ledger SHA-256 does not match the manifest');
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'altmanai-ledger-verify-'));
const temporaryLedger = join(temporaryDirectory, 'evidence.ndjson');
try {
  await writeFile(temporaryLedger, source, { mode: 0o600 });
  const verification = await new EvidenceLedger(temporaryLedger).verify();
  if (!verification.valid) {
    throw new Error(`Restored ledger chain is invalid: ${verification.reason}`);
  }
  if (verification.records !== manifest.records) {
    throw new Error(`Record count mismatch: expected ${manifest.records}, got ${verification.records}`);
  }
  if (verification.lastHash !== manifest.last_record_hash) {
    throw new Error('Last ledger hash does not match the manifest');
  }

  console.log(JSON.stringify({
    status: 'backup_valid',
    manifestPath,
    backupPath,
    records: verification.records,
    lastHash: verification.lastHash,
    sourceSha256: manifest.source_sha256,
    backupSha256: manifest.backup_sha256
  }));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
