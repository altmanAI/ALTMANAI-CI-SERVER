# Contributing

## Before opening a pull request

1. Keep the change focused and reversible.
2. Run `npm run check` and `npm test`.
3. Update tests and documentation when behavior changes.
4. Complete every section of the pull-request template.
5. Disclose AI assistance accurately.
6. Never commit secrets, credentials, private keys, customer data, or private webhook payloads.

## Engineering expectations

- Prefer Node.js standard-library capabilities unless a dependency has a documented security and operational justification.
- Preserve webhook raw bytes until signature verification is complete.
- Keep policy evaluation deterministic.
- Do not weaken Blake Hunter Altman authorization semantics.
- Add evidence for every claimed capability.

## Commit style

Use concise imperative messages, for example:

```text
Add installation-token authentication
Harden webhook body limits
Document evidence retention
```
