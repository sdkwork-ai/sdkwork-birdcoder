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
| Human communication | `sdkwork-im` owner boundary; no PC Conversation/Message persistence |
| Identity and organization scope | IAM SDK/runtime |
| Sandbox storage | Agents `drive/drive` composition plus Drive SDK |
| Documents | Agents `document/documents` composition plus Documents App SDK |
| BirdCoder System metadata | BirdCoder App SDK |

The PC surface uses one canonical Agents `projectId`. It has no Workspace
service, BirdCoder Project identifier, parallel Session, or transcript store.

## Data Ownership

PC owns no business database. Agents Project, Session, Turn, Session Item,
Interaction, Checkpoint, Runtime Binding, and composition records remain in the
[`sdkwork-agents` table registry](../../../sdkwork-agents/database/contract/table-registry.json).
Their registered physical namespace is `ai_agent_*`; PC must not introduce an
alternate `agents_*`, Workspace, Project, Session, Conversation, or Message
table. Product AI Skills remain in `sdkwork-skills`, while human Conversation
and Message records remain in `sdkwork-im`.

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
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test
pnpm dev:browser:standalone
pnpm dev:desktop
```

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc check
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
```

The PC commands remain scoped to the PC source graph and its real SDK
dependencies. Repository-root `pnpm lint` is the broader multi-surface quality
gate and is not used as an app-local script implementation.

## Documentation

- [PC documentation index](docs/README.md)
- [PC product supplement](docs/product/prd/PRD.md)
- [PC architecture supplement](docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Repository product PRD](../../docs/product/prd/PRD.md)
- [Repository technical architecture](../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [PC specs](specs/README.md)

Global rules remain in
[`../../../sdkwork-specs/`](../../../sdkwork-specs/README.md).
