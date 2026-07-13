# Security Policy

## Supported version

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, exposed credential, webhook secret, private key, installation token, or exploitable bypass. Report it privately through the official security contact listed by AltmanAI.

Include:

- affected commit or release
- reproduction steps
- impact assessment
- sanitized evidence
- proposed mitigation, when available

## Security invariants

- Verify the webhook signature against the raw request body before JSON parsing.
- Reject missing, malformed, or mismatched signatures.
- Never log secrets, tokens, private keys, or complete webhook payloads.
- Accept Founder authorization only from the configured login and only as an exact standalone phrase.
- Keep GitHub App permissions at the minimum required scope.
- Run as a non-root container user.
- Keep evidence storage access-restricted and retention-controlled.

## Secret handling

Deployment secrets must be stored in a platform secret manager. The repository intentionally ignores `.env*`, private keys, and runtime ledger files.
