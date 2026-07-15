# SDKWork BirdCoder Documentation

This directory is the human documentation layer for the BirdCoder product. Global standards remain in `../sdkwork-specs`; machine contracts remain in `specs/`, manifests, OpenAPI, and module `component.spec.json` files.

## Canon

- [Product PRD](product/prd/PRD.md)
- [Technical architecture](architecture/tech/TECH_ARCHITECTURE.md)

These two files are the onboarding and review entrypoints. Product behavior belongs in the PRD. Repository-specific runtime, data, deployment, and ownership boundaries belong in the technical architecture.

## Working Documents

- [Requirements](product/requirements/)
- [Architecture decisions](architecture/decisions/)
- [Unified project/runtime boundary](architecture/decisions/ADR-20260713-unified-project-runtime-boundary.md)
- [Engineering plans](engineering/)

Working documents must link back to the Canon and may be deleted or archived after the requirement is closed. New implementation diaries and tool-specific `superpowers` plans are not accepted as a parallel documentation system.

## Guides And Evidence

- [Operator guides](guides/operator/README.md)
- [Deployment operations](guides/operator/deployment-operations.md)
- [Windows Server control plane](guides/operator/windows-server-control-plane.md)
- [Developer guides](guide/)
- [Reference](reference/)
- [Runbooks](runbooks/)
- [Release registry](release/releases.json)
- [Archive](archive/)

`docs/release/` is release evidence used by release automation and is excluded from the public documentation search index. Historical migrated material remains under `docs/archive/`; it is not current product or architecture authority.

## Documentation Policy

- Do not copy SDKWork standards into this repository.
- Do not create a second PRD or technical-architecture root.
- Prefer one concise Canon document plus traceable REQ/ADR records.
- Generated contracts, route inventories, package graphs, and database schemas are linked, not duplicated as prose.
- Release notes and verification evidence do not become architecture standards.
- Client folder mounts are device-private capabilities. Remote project metadata
  and server workspace roots are documented separately from client paths and
  browser handles.
- Remote execution is not described as available until the isolated-runner
  capability has implementation and release evidence.

Authority: `../sdkwork-specs/DOCUMENTATION_SPEC.md`.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm docs:build
```
