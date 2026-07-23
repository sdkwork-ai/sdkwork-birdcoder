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
- Skills and IM through their owner SDKs;
- browser-local directory handles;
- Tauri-local filesystem, Git, worktree, terminal, and allowlisted device
  state;
- no PC business database, raw HTTP transport, or copied SDK authority.

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm check:desktop
pnpm docs:build
```
