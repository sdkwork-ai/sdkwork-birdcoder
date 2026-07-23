# SDKWork BirdCoder PC Specs

This is the human index for the PC component contract. Machine authority is
[`component.spec.json`](component.spec.json); global standards remain in
[`../../../../sdkwork-specs/`](../../../../sdkwork-specs/README.md).

## Component Boundary

| Area | Contract |
| --- | --- |
| Surface | PC browser and Tauri |
| Project | Canonical Agents `AgentProject` |
| Session | Canonical Agents Session hierarchy |
| Human messaging | IM, distinct from Agents Session Items |
| Local persistence | Allowlisted device/capability state only |
| Native capability | Tauri filesystem, Git, worktree, terminal |
| Transport | Injected generated owner SDKs |

PC uses one `projectId`. It owns no Workspace aggregate, BirdCoder Project,
business database, generated SDK fork, or raw HTTP service.

## Data Authority

| Fact | System of record | PC responsibility |
| --- | --- | --- |
| Project, composition, Session, Turn, Session Item, Interaction, Checkpoint, Runtime Binding | [`sdkwork-agents`](../../../../sdkwork-agents/database/contract/table-registry.json) | Consume Agents App SDK; never persist a copy |
| Product AI Skills | `sdkwork-skills` | Consume Skills App SDK |
| Document content and versions | `sdkwork-documents` | Resolve Agents `document/documents` slots through Documents App SDK |
| Human Conversation and Message | `sdkwork-im` | Keep distinct from Agents Session Items; no local persistence |
| Device mount, layout, and terminal multiplexing state | PC host boundary | Allowlisted local state only; never a business projection |

The Agents database prefix registry owns the canonical `ai_agent_*` physical
namespace. PC declares no database table, migration, ORM entity, or alternate
Workspace/Project/Session identifier.

## Canonical Standards

- [`APP_PC_ARCHITECTURE_SPEC.md`](../../../../sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md)
- [`APP_PC_REACT_UI_SPEC.md`](../../../../sdkwork-specs/APP_PC_REACT_UI_SPEC.md)
- [`DESKTOP_APP_ARCHITECTURE_SPEC.md`](../../../../sdkwork-specs/DESKTOP_APP_ARCHITECTURE_SPEC.md)
- [`APP_SDK_INTEGRATION_SPEC.md`](../../../../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md)
- [`SECURITY_SPEC.md`](../../../../sdkwork-specs/SECURITY_SPEC.md)
- [`TEST_SPEC.md`](../../../../sdkwork-specs/TEST_SPEC.md)
- [`DOCUMENTATION_SPEC.md`](../../../../sdkwork-specs/DOCUMENTATION_SPEC.md)

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm --dir apps/sdkwork-birdcoder-pc check:component-spec-paths
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
```
