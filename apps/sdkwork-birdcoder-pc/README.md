# SDKWork BirdCoder PC

Application: sdkwork-birdcoder-pc  
Surface: PC browser and Tauri desktop  
Status: active, pre-launch  
Owner: SDKWork maintainers

This application root provides the PC coding workbench. It consumes
domain-owner SDKs and adds browser/Tauri presentation and local host
capabilities; it does not own a second business data model.

## Domain Integration

| Capability | Integration |
| --- | --- |
| Project, composition, Session, Turn, Session Item, Runtime Binding | Generated Agents App SDK |
| Skills | Generated Skills App SDK |
| Human communication | Generated IM App SDK |
| Identity and organization scope | IAM SDK/runtime |
| Sandbox storage | Agents `drive/drive` composition plus Drive SDK |
| Documents | Documents SDK; project composition unavailable until Agents supports `document/documents` |
| BirdCoder System metadata | BirdCoder App SDK |

The PC surface uses one canonical Agents `projectId`. It has no Workspace
service, BirdCoder Project identifier, parallel Session, or transcript store.

## Host Capabilities

Browser directory handles remain browser-local. Tauri owns native directory
selection, filesystem access, Git, worktrees, terminals, and one allowlisted
`device_state_entry` table. `ProjectDeviceMountRegistry` is subject-scoped
and keyed by canonical `projectId`.

## Structure

| Path | Purpose |
| --- | --- |
| `src/` | PC composition bootstrap |
| `packages/` | Surface-specific package families |
| `config/`, `etc/` | Safe source configuration |
| `specs/` | PC component contract |
| `docs/` | PC PRD and architecture supplement |
| `tests/` | PC integration and end-to-end tests |

## Development

```bash
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm dev:browser:standalone
pnpm dev:desktop
```

## Verification

```bash
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm typecheck
```

## Documentation

- [PC documentation index](docs/README.md)
- [PC product supplement](docs/product/prd/PRD.md)
- [PC architecture supplement](docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Repository product PRD](../../docs/product/prd/PRD.md)
- [Repository technical architecture](../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [PC specs](specs/README.md)

Global rules remain in
[`../../../sdkwork-specs/`](../../../sdkwork-specs/README.md).
