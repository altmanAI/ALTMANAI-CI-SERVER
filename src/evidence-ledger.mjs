import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from './crypto.mjs';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digestRecord(record) {
  const withoutHash = { ...record };
  delete withoutHash.record_hash;
  return sha256(JSON.stringify(stable(withoutHash)));
}

export class EvidenceLedger {
  constructor(path) {
    this.path = path;
    this.previousHash = null;
    this.deliveryIds = new Set();
    this.inFlightDeliveryIds = new Set();
    this.writeQueue = Promise.resolve();
    this.initialized = false;
    this.initializePromise = null;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = this.initializeFromDisk();
    try {
      await this.initializePromise;
      this.initialized = true;
    } finally {
      this.initializePromise = null;
    }
  }

  async initializeFromDisk() {
    await mkdir(dirname(this.path), { recursive: true });
    const content = await this.readContent();
    const verification = this.verifyContent(content);
    if (!verification.valid) {
      throw new Error(`Evidence ledger verification failed: ${verification.reason}`);
    }

    this.previousHash = verification.lastHash;
    this.deliveryIds.clear();
    for (const line of content.split('\n').filter(Boolean)) {
      const record = JSON.parse(line);
      if (record.delivery_id) this.deliveryIds.add(record.delivery_id);
    }
  }

  async readContent() {
    try {
      return await readFile(this.path, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw error;
    }
  }

  verifyContent(content) {
    let previousHash = null;
    let index = 0;
    for (const line of content.split('\n').filter(Boolean)) {
      index += 1;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        return { valid: false, records: index, reason: 'invalid JSON record' };
      }
      if (record.previous_hash !== previousHash) {
        return { valid: false, records: index, reason: 'previous_hash mismatch', recordId: record.record_id };
      }
      const expected = digestRecord(record);
      if (record.record_hash !== expected) {
        return { valid: false, records: index, reason: 'record_hash mismatch', recordId: record.record_id };
      }
      previousHash = record.record_hash;
    }
    return { valid: true, records: index, lastHash: previousHash };
  }

  hasDelivery(deliveryId) {
    return Boolean(deliveryId && (this.deliveryIds.has(deliveryId) || this.inFlightDeliveryIds.has(deliveryId)));
  }

  tryBeginDelivery(deliveryId) {
    if (!deliveryId) return false;
    if (this.hasDelivery(deliveryId)) return false;
    this.inFlightDeliveryIds.add(deliveryId);
    return true;
  }

  endDelivery(deliveryId) {
    if (deliveryId) this.inFlightDeliveryIds.delete(deliveryId);
  }

  append(entry) {
    const operation = this.writeQueue.then(async () => {
      if (!this.initialized) await this.initialize();
      const record = {
        schema_version: '1.1',
        record_id: randomUUID(),
        created_at: new Date().toISOString(),
        previous_hash: this.previousHash,
        ...entry
      };
      record.record_hash = digestRecord(record);
      await appendFile(this.path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
      this.previousHash = record.record_hash;
      if (record.delivery_id) this.deliveryIds.add(record.delivery_id);
      return record;
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async verify() {
    await this.writeQueue;
    if (this.initializePromise) await this.initializePromise;
    return this.verifyContent(await this.readContent());
  }
}
