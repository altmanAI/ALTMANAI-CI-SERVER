# Governance

## Authority boundary

`altmanai-ci-server` is an enforcement tool, not an independent authority. It evaluates evidence against a versioned policy and reports the result. Final accountable authority remains with authorized humans at AltmanAI and Altman Family Group LLC.

## Founder approval

Material changes require an attributable pull-request comment from the configured Founder GitHub identity. The exact phrase is configured through `FOUNDER_APPROVAL_PHRASE` and defaults to:

> All Clear for Impact

The service must never create, infer, paraphrase, or impersonate this approval.

## Policy changes

Changes to any of the following are material:

- `src/**`
- `.github/**`
- `config/**`
- `Dockerfile`
- `package.json`
- governance, proof, security, and licensing files

Policy changes require documented rationale, validation, rollback planning, AI-assistance disclosure, and Founder authorization.

## Evidence

Every processed webhook creates an append-only record containing the repository, pull request, commit SHA, policy version, policy digest, decision, finding codes, and resulting GitHub check identifier.

## AI-assisted work

AI systems may assist with research, implementation, testing, and documentation. Every material pull request must identify AI assistance and the accountable human reviewer. AI assistance is not approval.
