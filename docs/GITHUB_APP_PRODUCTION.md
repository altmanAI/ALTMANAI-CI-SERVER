# Production GitHub App Setup

This runbook creates the least-privilege GitHub App used by `altmanai-ci-server` to inspect pull requests and publish the required **AltmanAI Governance Gate** check.

## 1. Ownership and scope

Register the App under the GitHub owner that controls the protected repositories. For the initial rollout, install it only on:

1. `ALTMANAI-CI-SERVER`
2. one additional low-risk AltmanAI repository after the self-governance tests pass

Do not request organization-wide access during the first deployment.

## 2. Generate the webhook secret

Generate at least 32 random bytes locally:

```bash
openssl rand -hex 32
```

Store the value in a password manager long enough to configure both GitHub and the deployment platform. Do not place it in shell history, source control, issue comments, screenshots, or documentation.

## 3. Register the GitHub App

In GitHub, open the owner account settings and choose **Developer settings → GitHub Apps → New GitHub App**.

Recommended values:

| Field | Value |
|---|---|
| GitHub App name | `AltmanAI Governance Gate` |
| Homepage URL | `https://www.altmanai.tech` |
| Webhook | Active |
| Webhook URL | `https://altmanai-ci-server.fly.dev/webhooks/github` |
| Webhook secret | generated secret |
| SSL verification | Enabled |
| User authorization | Not required for Phase 1 |

If the Fly app name changes, update the webhook hostname accordingly.

## 4. Repository permissions

Grant only these permissions:

| Permission | Access | Why |
|---|---|---|
| Checks | Read and write | Publish `AltmanAI Governance Gate` results |
| Contents | Read-only | Inspect repository metadata and protected paths |
| Issues | Read-only | Read pull-request issue comments containing Founder authorization |
| Metadata | Read-only | Required GitHub App baseline |
| Pull requests | Read-only | Read pull-request data and changed files |

Everything else remains **No access**.

## 5. Event subscriptions

Subscribe only to:

- **Pull request**
- **Issue comment**

The service acknowledges and records unsupported events as ignored, but GitHub should not send unnecessary event classes.

## 6. Create and protect the private key

After registering the App:

1. Record the numeric **App ID**.
2. Generate one private key.
3. Download the `.pem` file once.
4. Move it immediately into an encrypted local secret store.
5. Never commit, upload, email, or paste it into a public interface.

The deployment receives the key only through the platform secret manager.

## 7. Install the App

Choose **Install App**, select the AltmanAI owner, then choose **Only select repositories**.

Initial repository selection:

- `ALTMANAI-CI-SERVER`

After the complete self-governance test matrix passes, add one other core repository.

## 8. Store Fly.io secrets

From a trusted operator machine:

```bash
fly secrets set \
  WEBHOOK_SECRET='<generated-webhook-secret>' \
  GITHUB_APP_ID='<numeric-app-id>' \
  GITHUB_PRIVATE_KEY="$(cat /secure/path/github-app-private-key.pem)" \
  FOUNDER_GITHUB_LOGIN='altmanAI' \
  ALLOWED_GITHUB_OWNER='altmanAI' \
  --app altmanai-ci-server
```

Do not set `GITHUB_TOKEN` in production.

## 9. Validate the installation

1. Deploy the service.
2. In the GitHub App settings, use the recent deliveries view to redeliver a `ping` event.
3. Confirm an HTTP `202` response.
4. Confirm `/readyz` returns HTTP `200`.
5. Open a test pull request without the required sections and confirm the check fails.
6. Correct the pull request sections and confirm it re-evaluates.
7. Post `All Clear for Impact` as a standalone comment from the configured Founder account and confirm the governed change passes.
8. Run `npm run verify-ledger` inside the deployed machine and verify the new records.

## 10. Require the check in branch protection

For each protected repository, configure the default branch ruleset to require:

```text
AltmanAI Governance Gate
```

Recommended Phase 1 rules:

- require a pull request before merging;
- require the governance check to pass;
- block force pushes;
- block branch deletion;
- require conversation resolution;
- limit bypass permission to the smallest accountable-human group;
- do not enable automatic merge until deployment behavior is proven.

## 11. Webhook-secret rotation

The runtime accepts one current and one previous secret to permit controlled overlap.

1. Generate the new secret.
2. Set `WEBHOOK_SECRET_PREVIOUS` to the current secret and `WEBHOOK_SECRET` to the new secret in Fly secrets.
3. Deploy and verify `/readyz`.
4. Update the GitHub App webhook secret to the new value.
5. Redeliver a GitHub event and confirm HTTP `202`.
6. Remove the previous secret:

```bash
fly secrets unset WEBHOOK_SECRET_PREVIOUS --app altmanai-ci-server
```

7. Record the rotation date and operator in the decision log without recording either secret.

## 12. Private-key rotation

1. Generate a second private key in the GitHub App settings.
2. Update `GITHUB_PRIVATE_KEY` in Fly secrets and deploy.
3. Confirm successful GitHub API access and check publication.
4. Delete the previous GitHub App private key.
5. Record the rotation event without storing key material.
