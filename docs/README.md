# BirdCoder Documentation

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: [`DOCUMENTATION_SPEC.md`](../../sdkwork-specs/DOCUMENTATION_SPEC.md)

This is the human documentation index for the Rust backend and PC
browser/Tauri application. Machine contracts remain in `specs/`, authored
API contracts in `apis/` and `sdks/*/openapi/`, and generated code in its
declared SDK workspace.

## Canon

- [Product PRD](product/prd/PRD.md)
- [Technical architecture](architecture/tech/TECH_ARCHITECTURE.md)
- [PC product and architecture supplement](../apps/sdkwork-birdcoder-pc/docs/README.md)

## Current Boundary

- BirdCoder server business tables: **0**
- BirdCoder App API operations: **4 System reads**
- BirdCoder Backend API operations: **0**
- BirdCoder Open API operations: **0**
- BirdCoder IAM permissions: **4**

Project, composition, Session, Turn, Session Item, Interaction, Runtime
Binding, Artifact, and Checkpoint belong to `sdkwork-agents`. Skills belong to
`sdkwork-skills`. Human Conversation, Message, Member, and ReadCursor belong
to `sdkwork-im`. AI Session Items and IM Messages have different business
semantics and are never persisted as copies of each other.

The retired workbench Workspace grouping is IAM organization scope plus one
canonical Agents Project. The pre-launch cutover keeps no projection, shadow
table, dual write, alias, facade, or second Project id.

## Working And Evidence

- [Requirement: domain ownership convergence](product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
- [Decision: owner-composed stateless workbench](architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [Implementation plan](engineering/plans/PLAN-2026-0001-domain-boundary-cutover.md)
- [Direct cutover record](migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Changelog](changelogs/CHANGELOG.md)
- [Pre-launch release state](release/release-2026-07-22-01.md)

## Guides And Reference

- [Getting started](guide/getting-started.md)
- [Development](guide/development.md)
- [Deployment profiles and runtime targets](guide/application-modes.md)
- [Release and deployment](core/release-and-deployment.md)
- [Desktop host boundary](core/desktop.md)
- [Operator guide](guides/operator/README.md)
- [Agents runtime bindings and PC device mounts](guides/operator/runtime-bindings-and-device-mounts.md)
- [API reference](reference/api-reference.md)
- [Environment reference](reference/environment.md)
- [Command reference](reference/commands.md)

## Documentation Policy

Current documents describe only the final architecture. Superseded local
database, Workspace/Project authority, remote runtime-location service, and
copied API designs are not retained as active guidance. Historical migration
sequencing is recorded only where required for the direct-cutover evidence.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm check:live-docs-governance-baseline
pnpm docs:build
```
