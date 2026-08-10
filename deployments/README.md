# Deployments Directory

## Purpose
Deployment descriptors, environment topology, packaging handoff files, infrastructure examples, and release deployment documentation.

`deployments/deploy.yaml` is a typed manifest v2 authority for `cloud.test`,
`cloud.staging`, `cloud.production`, and `standalone.production`. The cloud
profiles expose the registered `code` role host
(`code-test.sdkwork.com` / `code-staging.sdkwork.com` / `code.sdkwork.com`)
per `../sdkwork-specs/APP_RUNTIME_TOPOLOGY_NAMING.md` section 9.2
(`applicationCode = birdcoder` keeps the registered host precedence rule).
Development profiles are source config under `etc/topology/` and are never
deploy targets; standalone profiles fold SDK base URLs to loopback.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Deployment descriptors
- Environment topology
- Packaging handoff files
- Infrastructure examples
- Release deployment documentation
- Docker configurations
- Kubernetes manifests
- Systemd service files
- Nginx configurations
- Deployment runbooks

## Forbidden Content
- Live secrets or private keys
- Local override files
- User-private runtime config
- Runtime state
- Temporary build artifacts
- Generated SDK output

## Related Specs
- [DEPLOYMENT_SPEC.md](../sdkwork-specs/DEPLOYMENT_SPEC.md)
- [SDKWORK_DEPLOY_SPEC.md](../sdkwork-specs/SDKWORK_DEPLOY_SPEC.md)
- [RUNTIME_DIRECTORY_SPEC.md](../sdkwork-specs/RUNTIME_DIRECTORY_SPEC.md)
- [ENVIRONMENT_SPEC.md](../sdkwork-specs/ENVIRONMENT_SPEC.md)
- [GITHUB_WORKFLOW_SPEC.md](../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md)
- [RELEASE_SPEC.md](../sdkwork-specs/RELEASE_SPEC.md)

## Deploy commands (SDKWork Deploy framework)

`deployments/deploy.yaml` (typed manifest v2) is validated and planned through the SDKWork Deploy
framework (`deployctl`); publishing runs through the `sdkwork-deployments` App SDK publisher.

| Command | Purpose |
| --- | --- |
| `pnpm deploy:validate` | Validate the deploy manifest (V1–V20) against the default profile |
| `pnpm deploy:plan` / `deploy:plan:standalone\|cloud` | Render the deployment plan (read-only) |
| `pnpm deploy:apply` | Apply a deployment; requires explicit `--profile --environment --artifact-id --artifact-digest --artifact-evidence --rollback-target --approval-ref` (fails closed otherwise) |
| `pnpm deploy:rollback` | Roll back a deployment (same explicit selection requirements) |
| `pnpm check:deploy-standard` | Manifest + `etc/` source-config identity checks (`check-deploy-standard.mjs` + `check-source-config-standard.mjs --enforce-profile-identity`) |

Environment support: `etc/sdkwork.deployment.config.json` declares the canonical
`development|test|staging|production` environments; `deploy:apply`/`deploy:rollback` select the
lifecycle environment explicitly and only `test|staging|production` are deployable
(SDKWORK_DEPLOY_SPEC V17). Cloud (kubernetes driver) side-effecting deployment runs through the
approved `sdkwork-github-workflow` lifecycle adapter (CI); the local deployctl executor covers the
nginx driver (standalone).

## Release publish

`pnpm release:publish` publishes the finalized release archive (default `web` family) through the
`@sdkwork/deployments-app-sdk` application publisher: resolve-or-create the Deploy site, upload the
archive to Drive, register the artifact (SHA-256) and record the release. Targets the configured
environment (`--environment development|test|staging|production`) with the Deploy API base URL
resolved from `etc/sdkwork.deployment.config.json`; use `release:publish:dry-run` to validate
without remote side effects.

## Verification
- [ ] No secrets or private keys in deployments/
- [ ] Deployment descriptors are valid and documented
- [ ] Infrastructure examples are safe and non-production
- [ ] Deployment runbooks are complete and accurate
- [ ] `pnpm check:deploy-standard` passes (manifest + source config identity)

## Notes
Deployments/ stores deployment topology, infrastructure descriptors, release handoff files, and deployment runbooks. It must not store live secrets, private keys, local override files, or runtime user config.
