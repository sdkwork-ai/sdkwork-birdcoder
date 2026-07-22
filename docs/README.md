# SDKWork BirdCoder Documentation

This directory is the human documentation layer for the BirdCoder product. Global standards remain in `../sdkwork-specs`; machine contracts remain in `specs/`, manifests, OpenAPI, and module `component.spec.json` files.

## Canon

- [Product PRD](product/prd/PRD.md)
- [Technical architecture](architecture/tech/TECH_ARCHITECTURE.md)

These two files are the onboarding and review entrypoints. Product behavior belongs in the PRD. Repository-specific runtime, data, deployment, and ownership boundaries belong in the technical architecture.

## Working Documents

- [Requirements](product/requirements/)
- [Architecture decisions](architecture/decisions/)
- [Domain ownership convergence](product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
- [Domain ownership decision](architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [Domain ownership cutover](migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Distributed project runtime locations](architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [Runtime-location migration plan](migrations/MIG-2026-0001-distributed-project-runtime-locations.md)
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
- Project identities remain distinct from runtime locations. Authorized
  runtime-location records own target-specific encrypted paths, Git snapshots,
  and execution capabilities; generic project metadata remains path-free.
- Runtime-location app-api responses use safe metadata only. A plaintext path
  is accepted only through a protected write-only registration flow and is
  decrypted only by the authenticated owning target for a verified action.
- Remote execution is not described as available until the isolated-runner
  capability has implementation and release evidence.
- BirdCoder owns only workbench workspace, project, document-binding,
  runtime-location, and sandbox-binding facts. AI sessions and assistant
  content use Agents; human messages use IM; Skills and all other platform
  domains use their owner SDKs.
- Active documents do not describe projections, shadow tables, synchronized
  caches, copied OpenAPI, or compatibility facades as supported architecture.

Authority: `../sdkwork-specs/DOCUMENTATION_SPEC.md`.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm check:domain-ownership
pnpm docs:build
```
