import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

test('creates and verifies a hash-chained ledger', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-ledger-'));
  const path = join(dir, 'evidence.ndjson');
  const ledger = new EvidenceLedger(path);
  await ledger.initialize();
  await ledger.append({ delivery_id: 'one', decision: 'success' });
  await ledger.append({ delivery_id: 'two', decision: 'failure' });
  const result = await ledger.verify();
  assert.deepEqual(result.valid, true);
  assert.equal(result.records, 2);
  assert.equal(ledger.hasDelivery('one'), true);
});

test('detects ledger tampering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-ledger-'));
  const path = join(dir, 'evidence.ndjson');
  const ledger = new EvidenceLedger(path);
  await ledger.initialize();
  await ledger.append({ decision: 'success' });
  const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace('success', 'failure'));
  const result = await ledger.verify();
  assert.equal(result.valid, false);
});

test('serializes concurrent writes into one valid chain', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-ledger-'));
  const path = join(dir, 'evidence.ndjson');
  const ledger = new EvidenceLedger(path);
  await ledger.initialize();
  await Promise.all(Array.from({ length: 25 }, (_, index) => ledger.append({ decision: 'success', index })));
  const result = await ledger.verify();
  assert.equal(result.valid, true);
  assert.equal(result.records, 25);
});

test('claims in-flight delivery IDs to prevent concurrent replay', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'altmanai-ledger-'));
  const ledger = new EvidenceLedger(join(dir, 'evidence.ndjson'));
  await ledger.initialize();
  assert.equal(ledger.tryBeginDelivery('delivery-1'), true);
  assert.equal(ledger.tryBeginDelivery('delivery-1'), false);
  ledger.endDelivery('delivery-1');
  assert.equal(ledger.tryBeginDelivery('delivery-1'), true);
});
