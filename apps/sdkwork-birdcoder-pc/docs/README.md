# BirdCoder PC Documentation

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md

This directory narrows the repository Canon to PC browser and Tauri behavior.
It does not redefine shared product, API, SDK, or domain contracts.

## Canon Supplements

- [PC product supplement](product/prd/PRD.md)
- [PC architecture supplement](architecture/tech/TECH_ARCHITECTURE.md)
- [Repository PRD](../../../docs/product/prd/PRD.md)
- [Repository technical architecture](../../../docs/architecture/tech/TECH_ARCHITECTURE.md)

## Current PC Boundary

- one canonical Agents `projectId`;
- Agents Project, composition, Session, Session Item, and Runtime Binding SDKs;
- Skills through the Skills App SDK;
- human Conversation and Message semantics reserved to `sdkwork-im`, distinct
  from Agents Session Items;
- browser-local directory handles;
- Tauri-local filesystem, Git, worktree, terminal, and allowlisted device
  state;
- no PC business database, raw HTTP transport, or copied SDK authority.

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test
pnpm --dir apps/sdkwork-birdcoder-pc check
pnpm check:desktop
pnpm docs:build
```
