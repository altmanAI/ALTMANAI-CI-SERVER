# Proof

## Current verified capabilities

The repository includes executable tests for:

- GitHub's documented HMAC-SHA256 webhook validation vector
- invalid webhook-signature rejection
- exact Founder identity and standalone phrase enforcement
- credential-like file blocking
- required AI-assistance disclosure
- hash-chain creation and tamper detection
- health endpoint behavior
- production configuration validation

## Validation commands

```bash
npm run check
npm test
npm run smoke
npm run verify-ledger
```

## Evidence format

Runtime evidence is written as newline-delimited JSON. Each record includes `previous_hash` and `record_hash`, creating a linear SHA-256 hash chain.

## Limitations

- The local ledger is only as durable as its storage volume.
- Duplicate protection is process-local plus ledger-backed; clustered deployments need shared storage or a queue.
- The service does not scan file contents for secrets in v0.1; it blocks high-risk paths and should be paired with GitHub secret scanning.
- The service does not configure branch protection automatically.
- Production certification, penetration testing, and independent security review are not yet complete.
