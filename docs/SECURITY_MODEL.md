# Security Model

## Threats addressed

- forged webhook deliveries
- payload tampering in transit
- unauthorized Founder approval
- committed credential-like files
- silent policy changes
- post-write evidence modification
- oversized request-body denial of service
- secret leakage through application logs

## Key controls

- high-entropy webhook secret
- HMAC-SHA256 verification with constant-time comparison
- exact identity and phrase matching
- versioned policy and policy digest in evidence
- bounded request body
- short request and API timeouts
- non-root container runtime
- minimal GitHub App permissions
- append-only hash chain

## Residual risk

- Compromise of the Founder GitHub account could authorize changes.
- Compromise of the GitHub App private key could let an attacker call permitted APIs.
- Local evidence storage can be deleted by a host administrator.
- Path checks do not replace content-based secret scanning.
- A single-process server is not sufficient for high availability.

## Required compensating controls

- phishing-resistant MFA for privileged GitHub accounts
- GitHub organization audit logs
- branch protection and required checks
- secret scanning and push protection
- key rotation
- independent backups and immutable retention
- deployment review and penetration testing
