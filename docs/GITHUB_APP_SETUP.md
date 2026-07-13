# Production GitHub App Setup

Use a dedicated GitHub App for AltmanAI CI Server. Do not use a personal access token as the normal production authentication method.

## 1. Create the App

Create the App under the accountable `altmanAI` GitHub account.

Recommended identity:

- **Name:** AltmanAI Governance Gate
- **Homepage:** `https://altmanai.tech`
- **Webhook URL:** initially the staging URL, then `https://altmanai-ci-server.fly.dev/webhooks/github`
- **Webhook active:** enabled
- **Expire user authorization tokens:** not applicable; the service uses installation authentication

Generate a unique webhook secret with at least 256 bits of entropy. Store it in the deployment secret manager as `WEBHOOK_SECRET`.

## 2. Repository permissions

Grant only:

| Permission | Access | Purpose |
|---|---:|---|
| Checks | Read and write | Publish `AltmanAI Governance Gate` Check Runs |
| Contents | Read | Read repository metadata required for governed evaluation |
| Issues | Read | Read pull-request discussion comments containing authorization |
| Metadata | Read | Required baseline GitHub App permission |
| Pull requests | Read | Read PR metadata and changed files |

Do not grant Administration, Actions, Deployments, Secrets, Members, or Organization permissions for Phase 1.

## 3. Subscribe to events

Subscribe only to:

- Pull request
- Issue comment

The service acknowledges unsupported event/action combinations as ignored and records them in the evidence ledger.

## 4. Install on selected repositories

Choose **Only select repositories**.

Initial sequence:

1. `ALTMANAI-CI-SERVER`
2. one additional core repository after the complete staging matrix passes

Do not install across every repository during the first deployment.

## 5. Generate and store the private key

Generate a private key from the GitHub App settings. GitHub provides the private key only as a downloaded PEM file.

Controls:

- transfer it directly to the deployment secret manager;
- store no copy in the repository;
- never paste it into issues, pull requests, chat logs, screenshots, build logs, or `.env` files;
- restrict any temporary local file to owner read/write permissions;
- securely delete the temporary local copy after Fly confirms the secret was set.

Set `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` in Fly's secret manager. The service mints short-lived installation tokens at runtime.

## 6. Verify installation behavior

After deployment:

1. send the GitHub App `ping` event;
2. confirm HTTP 2xx delivery;
3. open a controlled pull request;
4. confirm a Check Run named `AltmanAI Governance Gate` appears on the exact head SHA;
5. verify the evidence record contains the repository, PR number, head SHA, policy digest, Check Run identifier, authorization record, and evidence hash;
6. confirm the App cannot access a repository where it is not installed.

## 7. Webhook secret rotation

The current service accepts one active webhook secret. Rotation therefore requires a controlled coordinated change:

1. schedule a low-traffic maintenance window;
2. generate a new high-entropy secret;
3. update `WEBHOOK_SECRET` in Fly;
4. immediately update the GitHub App webhook secret to the same value;
5. deliver a `ping` event and verify HTTP 2xx;
6. open a controlled PR synchronization event and verify the governance check;
7. record the rotation time, operator, verification evidence, and incident status without recording the secret.

If validation fails, restore the previous secret in both locations immediately. Phase 2 should add dual-secret overlap support to eliminate this coordination window.

## 8. Private-key rotation

GitHub Apps can have more than one private key during rotation.

1. generate a new key in GitHub App settings;
2. deploy the new PEM as `GITHUB_PRIVATE_KEY`;
3. restart or redeploy the service;
4. verify installation-token creation and a live Check Run;
5. revoke and delete the old key in GitHub;
6. record the new key fingerprint and rotation evidence, never the private key.

Rotate immediately after suspected exposure, operator departure, or secret-manager compromise.

## 9. Emergency authentication exception

Static `GITHUB_TOKEN` authentication is disabled by default in production. A temporary exception requires all of the following:

- documented incident or GitHub App outage;
- least-privilege fine-grained token;
- explicit `ALLOW_STATIC_GITHUB_TOKEN=true`;
- short expiration;
- named accountable human approver;
- rollback time and deletion record;
- post-incident restoration of GitHub App authentication.

Never make the exception permanent.

## 10. Minimum audit record

For creation, installation, and every rotation, preserve:

- GitHub App name and App ID
- selected repositories
- permission and event-subscription snapshot
- deployment revision
- rotation timestamp
- accountable human operator
- test delivery identifiers
- Check Run URLs
- evidence ledger record hashes
- result and rollback status

The audit record must not contain secrets, private keys, tokens, or full webhook payloads.
