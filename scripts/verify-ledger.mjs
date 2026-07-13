import { resolve } from 'node:path';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';

const path = resolve(process.env.EVIDENCE_LEDGER_PATH || './data/evidence.ndjson');
const ledger = new EvidenceLedger(path);
const result = await ledger.verify();
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
