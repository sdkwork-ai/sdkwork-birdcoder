# PRD-02 Three-Layer Agent Platform

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder (consumer) + sdkwork-agents + sdkwork-kernel (siblings)
Updated: 2026-07-08
Parent: [PRD.md](PRD.md)
Specs: `../sdkwork-kernel/specs/AGENT_KERNEL_SPEC.md`, `../sdkwork-agents/specs/AGENTS_KERNEL_BOUNDARY_SPEC.md`, `SDK_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`

## 1. Background And Problem

A professional AI coding IDE must manage multiple code-agent frameworks such as Codex, Claude Code, Gemini CLI, and OpenCode, and must leave room for autonomous frameworks such as OpenClaw and Hermes plus framework-level implementations such as Rig. The platform must provide unified product behavior without binding the product directly to every provider's SDK, protocol, process model, or database assumptions.

The required product architecture is therefore a strict three-layer model:

- `sdkwork-kernel` standardizes agent SPI and code-kernel SPI, provider manifests, bindings, protocol adapters, runtime policies, telemetry, and fail-closed provider behavior.
- `sdkwork-agents` is the business application layer. It owns agent persistence, API/SDK surfaces, task/session/message/interaction/audit records, configuration, composition slots, and the `sdkwork-agents-runtime-facade`.
- `sdkwork-birdcoder` is the IDE product. It owns workbench UX, coding-session projections, local/native host integration, release governance, and product-specific routes. Agent operations must be consumed through `sdkwork-agents` only.

## 2. Layer Responsibilities

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| `sdkwork-kernel` | Agent SPI, code-kernel SPI, provider bindings, model/tool/MCP/memory/host/policy/telemetry abstractions, fail-closed provider integration | Business `ai_*` tables, product UI, app/backend/open API, tenant-specific managed agent CRUD |
| `sdkwork-agents` | Managed agent business model, `ai_*` persistence, Open/App/Backend API, generated SDKs, runtime facade, composition slots to memory/knowledge/skills/prompts/drive/MCP | Redefining kernel SPI, BirdCoder UI, direct product-specific coding-session projection |
| `sdkwork-birdcoder` | IDE workbench, coding-session projection, code editor/terminal, product release/commercial readiness, app-side SDK consumption | Direct `sdkwork-agent-kernel` or provider crate consumption, agents database ownership, raw agents app-api HTTP |

## 3. Kernel Provider Matrix

| Framework | Provider Binding | Profile | SDK/Runtime Fact | BirdCoder Exposure |
| --- | --- | --- | --- | --- |
| Codex | `sdkwork-agent-provider-codex` | code-agent | Official OpenAI Codex SDK / CLI binding via TypeScript Node worker | P0 |
| Claude Code | `sdkwork-agent-provider-claude-code` | code-agent | Anthropic Claude Code SDK / CLI process binding | P0 |
| Gemini CLI | `sdkwork-agent-provider-gemini-cli` | code-agent | Gemini CLI provider binding | P0 |
| OpenCode | `sdkwork-agent-provider-opencode` | code-agent | OpenCode SDK with live approval/user-question mapping | P0 |
| OpenClaw | `sdkwork-agent-provider-openclaw` | autonomous-agent | Experimental official SDK / gateway binding in kernel manifest | P2, disabled by feature flag until conformance |
| Hermes | `sdkwork-agent-provider-hermes` | autonomous-agent | Process/IPC JSON-RPC binding, Python `run_agent`, optional `hermes-ink` UI/runtime | P2, disabled by feature flag until conformance |
| Rig | `sdkwork-agent-provider-rig` | framework | Rust-native framework crate/source integration; live model/tool execution still fail-closed where marked pending | Infrastructure, not product P0 |

Rule: when a supported SDK or runtime interface exists, integration belongs in `sdkwork-kernel` provider binding and conformance tests. BirdCoder can expose it only through `sdkwork-agents` catalog/API after capability, security, observability, and support posture are production-ready.

## 4. SDKWork Agents Business Surface

`sdkwork-agents` currently exposes 95 HTTP operations:

| Surface | Prefix | Operations | SDK |
| --- | --- | ---: | --- |
| Open API | `/agent/v3/api` | 27 | `@sdkwork/agents-sdk` |
| App API | `/app/v3/api` | 35 | `@sdkwork/agents-app-sdk` |
| Backend API | `/backend/v3/api` | 33 | `@sdkwork/agents-backend-sdk` |

App API groups BirdCoder should consume through the composed SDK facade:

| Group | Path Pattern | Purpose |
| --- | --- | --- |
| Agent CRUD | `/app/v3/api/ai/agents` | Managed agent configuration |
| Composition slots | `.../composition_slots` | Memory, knowledge, skills, prompts, drive, MCP bindings |
| Provider bindings | `.../provider_bindings` | Engine/provider binding management |
| Sessions | `.../sessions` | Managed chat session lifecycle |
| Messages | `.../messages` | Message query and send |
| Live interactions | `.../interactions` | Approval and user-question pause points |
| Tasks | `.../tasks` | Scheduled/deferred task CRUD and execution |
| Runtime catalog | `/app/v3/api/ai/code_engines` | Code engine catalog projection |
| MCP marketplace | `/app/v3/api/ai/mcp_servers` | MCP marketplace list/search |

The scheduled task API is live on all three surfaces and persists `ai_agent_task`. The non-GA gap is `agents.taskRuns.list` / `ai_agent_task_run`, which remains deferred until kernel `AgentRun` projection lands.

## 5. Memory And Composition

Memory semantics are defined by kernel SPI, but durable memory storage and growth behavior belong to sibling modules and are referenced through `sdkwork-agents` composition slots.

| Capability | Owner | Integration Path | Status |
| --- | --- | --- | --- |
| Permanent memory | `sdkwork-memory` | `ai_agent_composition_slot` + memory app SDK/runtime mount | Slot defined, runtime mount pending |
| User memory | `sdkwork-memory` | Same slot model with user scope | Slot defined, runtime mount pending |
| Growth memory | `sdkwork-memory` | Same slot model with learning/feedback scope | Slot defined, runtime mount pending |
| Knowledge retrieval | `sdkwork-knowledgebase` | Composition slot + knowledgebase SDK | Slot defined |
| Skills | `sdkwork-skills` | Composition slot + skills SDK | BirdCoder skills packages exist; runtime unification pending |
| Prompts | `sdkwork-prompts` | Composition slot + prompts SDK | Preview/prompt optimization API exists |
| Drive | `sdkwork-drive` | Drive references and upload/download SDKs | Product upload integration deferred |
| MCP | MCP marketplace | `/app/v3/api/ai/mcp_servers` | App API done |

Agents must not duplicate memory tables inside `ai_*`; it stores references and runtime bindings only.

## 6. BirdCoder Product Requirements

Done:

- P0 code-agent execution for Codex, Claude Code, Gemini CLI, and OpenCode through kernel bridge and agents runtime facade.
- `KernelBridgeCodeEngineProvider` injected into standalone gateway.
- OpenCode approval/user-question live interaction routed through the kernel bridge.
- Agents app API exposes code-engine catalog and MCP marketplace.
- Agents preview response and prompt optimization call the runtime facade.
- BirdCoder PC infrastructure consumes `@sdkwork/agents-app-sdk` for code-engine catalog through a typed service boundary.

P5 evolution:

| ID | Requirement | Owner | Priority |
| --- | --- | --- | --- |
| EV-01 | Complete BirdCoder PC agent/session/message/task CRUD services and UI through `@sdkwork/agents-app-sdk` | birdcoder | P1 |
| EV-02 | Add task-run projection: kernel `AgentRun` -> `ai_agent_task_run` -> `agents.taskRuns.list` | kernel + agents | P1 |
| EV-03 | Mount `sdkwork-memory` slots at runtime through agents composition | agents | P1 |
| EV-04 | Productize replayable message/run event stream beyond current send streaming | agents | P2 |
| EV-05 | Expose OpenClaw/Hermes optional catalog behind conformance and feature flags | kernel + birdcoder | P2 |
| EV-06 | Document Rig + BirdCoder standalone deployment posture | ops | P2 |

## 7. Commercial Readiness

| Dimension | Current Grade | Gap | Path |
| --- | --- | --- | --- |
| Contract governance | A | None for BirdCoder OpenAPI; agents API facts must stay current | BirdCoder 162/162 zero defer; agents 95 ops generated SDK |
| Multi-engine execution | A | Autonomous engines not productized | EV-05 |
| Agent lifecycle UI | C+ | Catalog SDK service exists; full CRUD UI pending | EV-01 |
| Memory and knowledge composition | C | Slots defined but memory runtime mount pending | EV-03 |
| Task scheduling and run management | B- | Task CRUD live; task-run projection pending | EV-02 |
| Message/run streaming | B | `messages.create` streaming exists; durable replay/event stream pending | EV-04 |
| Release and metering | B+ | Commerce gateway wired; real artifacts pending | First governed release |

Conclusion: BirdCoder has the contract and runtime basis for PC private beta and enterprise K8s pilots. Industry-grade commercial agent-platform readiness requires completing EV-01 through EV-04 before broad SaaS launch.

## 8. Verification

```bash
pnpm run check:kernel-birdcoder-alignment
pnpm run check:agents-birdcoder-alignment
node scripts/birdcoder-kernel-integration-contract.test.mjs
node scripts/birdcoder-agents-integration-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/agents-catalog-sdk-unwrapped-response-contract.test.ts
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
```

Machine-readable trackers:

- `specs/kernel-birdcoder-alignment.spec.json`
- `specs/agents-birdcoder-alignment.spec.json`

Architecture authority:

- [TECH-36 three-layer agent platform standard](../../architecture/tech/TECH-36-three-layer-agent-platform-standard.md)
- [TECH-30 kernel boundary](../../architecture/tech/TECH-30-kernel-birdcoder-boundariesstandard.md)
- [TECH-33 agents boundary](../../architecture/tech/TECH-33-agents-birdcoder-boundariesstandard.md)

## 9. Non-Goals

- Copying kernel or agents specs into the BirdCoder repository.
- Handwriting HTTP calls around generated SDKs.
- Exposing autonomous providers in P0 product surfaces without conformance, feature flags, security review, and support posture.
- Putting business database schema in `sdkwork-kernel`.
