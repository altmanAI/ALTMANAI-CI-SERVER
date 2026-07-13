import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

const execFileAsync = promisify(execFile);
const backupScript = fileURLToPath(new URL('../scripts/backup-ledger.mjs', import.meta.url));

async function runBackup(ledgerPath, backupDirectory, retentionDays = '30') {
  return execFileAsync(process.execPath, [backupScript], {
    env: {
      ...process.env,
      EVIDENCE_LEDGER_PATH: ledgerPath,
      EVIDENCE_BACKUP_DIR: backupDirectory,
      EVIDENCE_BACKUP_RETENTION_DAYS: retentionDays
    }
  });
}

test('backup command verifies the ledger and writes a matching SHA-256 manifest', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'altmanai-backup-'));
  const ledgerPath = join(directory, 'evidence.ndjson');
  const backupDirectory = join(directory, 'backups');
  const ledger = new EvidenceLedger(ledgerPath);
  await ledger.append({ delivery_id: 'backup-test-1', decision: 'accepted' });
  await ledger.append({ delivery_id: 'backup-test-2', decision: 'blocked' });

  const { stdout } = await runBackup(ledgerPath, backupDirectory);
  const result = JSON.parse(stdout);
  const backup = await readFile(result.backupPath);
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));

  assert.equal(result.status, 'backup_created');
  assert.equal(manifest.ledger_verification.valid, true);
  assert.equal(manifest.ledger_verification.records, 2);
  assert.equal(
    manifest.content_sha256,
    createHash('sha256').update(backup).digest('hex')
  );
  assert.equal(backup.toString('utf8'), await readFile(ledgerPath, 'utf8'));
});

test('backup command refuses a tampered ledger', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'altmanai-backup-corrupt-'));
  const ledgerPath = join(directory, 'evidence.ndjson');
  const backupDirectory = join(directory, 'backups');
  const ledger = new EvidenceLedger(ledgerPath);
  await ledger.append({ delivery_id: 'backup-test-corrupt', decision: 'accepted' });

  const content = await readFile(ledgerPath, 'utf8');
  await writeFile(ledgerPath, content.replace('accepted', 'altered'));

  await assert.rejects(
    runBackup(ledgerPath, backupDirectory),
    /Refusing to back up an invalid evidence ledger/
  );
});
