# GitHub Actions Recovery

## Current containment

GitHub-hosted jobs have failed before their first executable step across multiple `altmanAI` repositories. This behavior is outside the repository source and indicates an account, billing, policy, abuse-prevention, or hosted-runner availability restriction.

To prevent repeated red runs while that restriction exists, `.github/workflows/ci.yml` is manual-only. The workflow itself avoids third-party actions and performs exact-revision checkout, Node.js 22 validation, all automated tests, ledger verification, package inspection, and a Docker image build.

## Recovery procedure

1. Open GitHub account and repository **Settings → Actions → General**.
2. Confirm GitHub Actions is enabled and hosted runners are permitted.
3. Confirm account billing, spending limits, and payment verification are healthy.
4. Manually dispatch the `CI (manual while hosted runners are restricted)` workflow.
5. Require both `Node 22 validation` and `Container build` to pass.
6. Restore automatic triggers:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

7. Open a test pull request and confirm the required checks execute before enabling branch protection.

## Evidence boundary

A workflow that fails before step one has not executed repository code. Local v0.2.0 validation completed 38 tests with zero failures and 91.59% line coverage, but that does not substitute for a successful hosted-runner execution.
