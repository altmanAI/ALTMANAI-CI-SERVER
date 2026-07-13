import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runScript(script, env) {
  return spawnSync(process.execPath, [script], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

test('ledger backup verifies and rejects later archive tampering', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'altmanai-backup-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledgerPath = join(directory, 'evidence.ndjson');
  const backupDir = join(directory, 'backups');

  const ledger = new EvidenceLedger(ledgerPath);
  await ledger.append({ delivery_id: 'delivery-1', decision: 'accepted' });
  await ledger.append({ delivery_id: 'delivery-2', decision: 'success' });

  const env = {
    EVIDENCE_LEDGER_PATH: ledgerPath,
    EVIDENCE_BACKUP_DIR: backupDir,
    LEDGER_BACKUP_RETENTION_DAYS: '30'
  };

  const backup = runScript('scripts/backup-ledger.mjs', env);
  assert.equal(backup.status, 0, backup.stderr);
  assert.equal(JSON.parse(backup.stdout).records, 2);

  const verify = runScript('scripts/verify-backup.mjs', env);
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).status, 'backup_valid');

  const archive = (await readdir(backupDir)).find((name) => name.endsWith('.ndjson.gz'));
  assert.ok(archive);
  await appendFile(join(backupDir, archive), Buffer.from('tampered'));

  const rejected = runScript('scripts/verify-backup.mjs', env);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Backup SHA-256 does not match the manifest/);
});
