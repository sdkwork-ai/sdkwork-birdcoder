# First Governed Rust And PC Release

Status: active pre-launch checklist
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: RELEASE_SPEC.md, SUPPLY_CHAIN_SECURITY_SPEC.md

This checklist covers the Rust gateway, PC web artifact, and Tauri desktop
artifact. H5 and Flutter are outside this release evidence.

## Architecture Preconditions

- BirdCoder ownership is 0 server business tables, 4 System App operations,
  0 Backend/Open operations, and 4 permissions.
- PC uses canonical Agents Projects, Sessions, and Runtime Bindings.
- Tauri device state passes its allowlist and local mount isolation tests.
- No active compatibility, projection, copied SDK, raw HTTP, or remote
  project-path authority remains.

## Rehearsal

```bash
pnpm check:arch
pnpm check:desktop
pnpm check:server
pnpm check:multi-mode
pnpm check:release-flow
pnpm release:fixture:ready
pnpm release:candidate:dry-run
pnpm release:rehearsal:verify
```

Rehearsal output cannot be promoted as a real release artifact.

## Real Artifacts

```bash
pnpm release:plan
pnpm release:preflight:desktop-signing
pnpm release:package:desktop
pnpm release:package:web
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:verify-trust:desktop
pnpm release:smoke:desktop
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
pnpm release:assert-ready
```

Enable publication only after immutable checksums, signatures, SBOM,
attestations, rollback evidence, and every stop-ship gate are verified.

## Publishing Through SDKWork Deploy

`release:finalize` produces the immutable aggregate release; publication then
records it in the SDKWork Deploy control plane through the
`@sdkwork/deployments-app-sdk` application publisher (resolve-or-create site →
upload archive to Drive → register artifact with SHA-256 → record release):

```bash
# Validate the publish request without remote side effects
pnpm release:publish:dry-run -- --family web --deployment-profile standalone --environment development

# Publish the web release archive (default target: standalone.development)
pnpm release:publish -- --family web

# Publish to another environment (test/staging/production) or profile
pnpm release:publish -- --family web --deployment-profile cloud --environment test
```

The Deploy API base URL is resolved from `etc/sdkwork.deployment.config.json`
(development → the local gateway at `http://127.0.0.1:10240`, whose
api-assembly composes the Deploy App API). Dual-token credentials come from
`--access-token`/`--auth-token` or `SDKWORK_CLI_ACCESS_TOKEN`/
`SDKWORK_CLI_AUTH_TOKEN`; local development may proceed without them when the
IAM dev auth fallback is enabled. The publish evidence chain is written to
`artifacts/release/publish-evidence.json`.

Deploying the published release is a separate, side-effecting step that always
selects an explicit lifecycle environment and immutable artifact identity:

```bash
pnpm deploy:plan:standalone          # nginx driver plan (read-only)
pnpm deploy:plan:cloud               # kubernetes driver plan (read-only)
# side-effecting apply requires profile + environment + artifact identity
pnpm deploy:apply -- --profile standalone.production --environment production \
  --artifact-id <id> --artifact-digest sha256:<digest> \
  --artifact-evidence <evidence.json> --rollback-target <target> --approval-ref <ref>
```

Cloud (kubernetes) side-effecting deployment runs through the approved
`sdkwork-github-workflow` lifecycle adapter (CI + GitHub Environments); the
local `deployctl` executor covers the nginx driver (standalone).
