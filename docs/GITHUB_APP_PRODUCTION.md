# Production GitHub App Setup

This runbook creates the least-privilege GitHub App used by `altmanai-ci-server` to inspect pull requests and publish the required **AltmanAI Governance Gate** check.

## Initial installation scope

Install the App only on:

1. `ALTMANAI-CI-SERVER`
2. one additional low-risk AltmanAI repository only after the self-governance matrix passes

Do not request account-wide repository access during Phase 1.

## Generate the webhook secret

```bash
openssl rand -hex 32
```

Store the value only in GitHub's App settings, the deployment secret manager, and an approved encrypted operator vault. Never place it in source control, issue comments, screenshots, or logs.

## Register the App

Open the controlling GitHub account's **Settings → Developer settings → GitHub Apps → New GitHub App**.

| Field | Phase 1 value |
|---|---|
| Name | `AltmanAI Governance Gate` |
| Homepage | `https://www.altmanai.tech` |
| Webhook | Active |
| Webhook URL | `https://altmanai-ci-server.fly.dev/webhooks/github` |
| SSL verification | Enabled |
| User authorization | Not required |

If the Fly app name changes, update the webhook host everywhere.

## Repository permissions

| Permission | Access | Purpose |
|---|---|---|
| Checks | Read and write | Publish `AltmanAI Governance Gate` results |
| Contents | Read-only | Inspect repository metadata and protected paths |
| Issues | Read-only | Read pull-request comments containing authorization |
| Metadata | Read-only | Required GitHub App baseline |
| Pull requests | Read-only | Read pull-request data and changed files |

Everything else remains **No access**.

## Event subscriptions

Subscribe only to:

- Pull request
- Issue comment

## Private key handling

1. Record the numeric App ID.
2. Generate one private key.
3. Move the downloaded PEM immediately into an encrypted operator vault.
4. Provide it to production only through the platform secret manager.
5. Never commit, email, upload, or paste it into a public interface.

## Install the App

Choose **Install App**, select the AltmanAI owner, and choose **Only select repositories**. Start with `ALTMANAI-CI-SERVER` only.

## Set Fly secrets

```bash
fly secrets set \
  WEBHOOK_SECRET='<generated-secret>' \
  GITHUB_APP_ID='<numeric-app-id>' \
  GITHUB_PRIVATE_KEY="$(cat /secure/path/github-app-private-key.pem)" \
  FOUNDER_NAME='Blake Hunter Altman' \
  FOUNDER_GITHUB_LOGIN='altmanAI' \
  FOUNDER_GITHUB_USER_ID='233472124' \
  ALLOWED_GITHUB_OWNER='altmanAI' \
  --app altmanai-ci-server
```

Do not set `GITHUB_TOKEN` in production. Keep `ALLOW_STATIC_GITHUB_TOKEN=false`.

## Validate the installation

1. Deploy the service.
2. Redeliver a GitHub App `ping` event.
3. Confirm HTTP `202`.
4. Confirm `/readyz` returns HTTP `200` and a valid ledger.
5. Confirm `/v1/verification` matches the repository-backed authorization record.
6. Open a test pull request that intentionally fails the required sections.
7. Correct the pull request and verify re-evaluation.
8. Post `All Clear for Impact` as a standalone comment from login `altmanAI`, user ID `233472124`, and verify that all other requirements must also pass.
9. Run `npm run verify-ledger` against the deployed ledger.

## Require the check

After the entire self-governance matrix passes, configure the default-branch ruleset to require:

```text
AltmanAI Governance Gate
```

Recommended Phase 1 rules:

- require a pull request before merge;
- require the governance check;
- require conversation resolution;
- block force pushes;
- block branch deletion;
- restrict bypass permission to the smallest accountable-human group.

## Webhook-secret rotation

The runtime accepts one current and one previous secret during a controlled overlap window.

1. Generate a new secret.
2. Set `WEBHOOK_SECRET_PREVIOUS` to the current value and `WEBHOOK_SECRET` to the new value.
3. Deploy and verify `/readyz`.
4. Update the GitHub App webhook secret.
5. Redeliver a real event and confirm HTTP `202`.
6. Remove the previous secret:

```bash
fly secrets unset WEBHOOK_SECRET_PREVIOUS --app altmanai-ci-server
```

7. Record the rotation date and operator without recording either secret.

## Private-key rotation

1. Generate a second GitHub App private key.
2. Update `GITHUB_PRIVATE_KEY` in the platform secret manager.
3. Deploy and confirm GitHub API access plus check publication.
4. Delete the previous private key in GitHub.
5. Record the rotation event without storing key material.
