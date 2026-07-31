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

## Durable Turn Input Queue

Agents owns the authenticated Turn input queue nested by Agent and Session. PC
uses the generated Agents App SDK through the injected Session service and
keeps only a bounded, disposable in-memory projection. It never writes queue
content to Web Storage, Tauri device state, or another local database.

Busy submissions are persisted before the composer clears. Atomic
`claim_next`, lease, fencing token, and queue-owned
`idempotencyKey + payloadHash` serialize execution across windows and transport
recovery. Completed Turns advance FIFO; uncertain acceptance remains executing;
failed or cancelled heads pause until edit, retry, reorder, or removal.
Executing entries are immutable. Clear preserves executing work, Session
deletion purges the nested queue, and logout clears only the local projection.
Startup, focus, visibility, online, and cross-window invalidation rehydrate
from Agents.

## Session Naming Boundary

Session is the only BirdCoder name for an agent work continuation. Shell, UI,
stores, services, events, view models, and authored contracts use Session
terminology and the canonical Agents Session identity. They must not introduce
a Thread DTO, identifier, store, service, route, event, or persistence model.

Codex `thread`, `threadId`, and `findInThread` are provider-native protocol
names. Only the Codex provider adapter and exact raw protocol fixtures may read
those names. The adapter must convert them before output to the canonical
Session identity, `providerSessionId`, and Session-named commands such as
`findInSessionTranscript`. Archive, rename, pin, navigation, and transcript
find reuse the existing Session and Session user-state capabilities.

Current-Session transcript find uses `Ctrl/Cmd+F`; project file search uses
`Ctrl/Cmd+Shift+F`. Transcript find is scoped by the stable Session transcript
key, clears on Session change, retains at most 150 matches, highlights rendered
matches and the active result, supports wrapped next/previous navigation, and
restores focus when closed.

## Workbench Mode Provider Contract

The Birdcoder sidebar has one persistent mode selector and one stable header
layout. The selected mode changes the admitted Agent Providers and the sidebar
information architecture; it does not create a second Project or Session
domain.

| Mode | Agents tier | Admitted engine and Agent identities |
| --- | --- | --- |
| Coding | `t1-code` | `codex` / `agent.intelligence.codex`; `claude-code` / `agent.intelligence.claude-code`; `gemini` / `agent.intelligence.gemini`; `opencode` / `agent.intelligence.opencode` |
| Work | `t2-autonomous` | `openclaw` / `agent.intelligence.openclaw`; `hermes` / `agent.intelligence.hermes` |

The generated Agents App SDK catalog is the availability authority. BirdCoder
admits an engine only when its normalized `engineId`, `agentId`, and `tier`
exactly match the selected mode's allowlist. Missing fields, mismatched tiers,
unknown engines, and future catalog entries fail closed. Invalid stored mode
values normalize to Coding.

Visibility and availability are deliberately separate. Coding continues to
show only catalog-admitted Providers. The Work new-task menu always shows the
fixed OpenClaw and Hermes Agent choices, including when the catalog is empty.
A Work Provider that is absent from the live catalog or has no usable model is
labelled not installed and cannot create a task; selecting it opens the
installation dialog.

Work Provider installation is supported only by the BirdCoder desktop app. The
UI passes an allowlisted Provider id, and the infrastructure maps that id to a
fixed official HTTPS installer, pinned baseline, shell profile, and
noninteractive arguments. Unknown ids fail before native host invocation;
browser installation fails with `desktop-required`. Setup or onboarding is
deferred so installation does not silently configure credentials or external
services. After a zero exit code, BirdCoder resets and reloads the generated
Agents catalog. It never fabricates catalog publication or task readiness; if
the exact Provider identity is still unavailable, the dialog asks the user to
restart or retry after the owning runtime publishes it.

| Provider | Installer authorities | Pinned baseline | Deferred step |
| --- | --- | --- | --- |
| OpenClaw | `https://openclaw.ai/install.ps1`; `https://openclaw.ai/install.sh` | `2026.7.2` | onboarding |
| Hermes Agent | `https://hermes-agent.nousresearch.com/install.ps1`; `https://hermes-agent.nousresearch.com/install.sh` | commit `cff9728587da4f3c0beed0786f9bea528e489f13` | setup |

The machine-readable authority and enforcement evidence live in
[`../../../../specs/agents-birdcoder-alignment.spec.json`](../../../../specs/agents-birdcoder-alignment.spec.json).

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
pnpm test:browser:smoke
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentTurnInputQueue.test.ts agentTurnInputQueueHook.test.tsx
```
