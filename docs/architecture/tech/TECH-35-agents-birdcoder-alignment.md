# TECH-35 Agents To BirdCoder Alignment Checklist

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-08
Specs: `AGENTS_KERNEL_BOUNDARY_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md`
Parent: [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md)

## Gate Tasks: P1-P4 Done

| ID | Owner | Title | Status |
| --- | --- | --- | --- |
| ABA-BC-01 | agents | Runtime facade exposes host, turn, catalog, and live interaction | done |
| ABA-BC-02 | birdcoder | Kernel bridge depends only on agents runtime facade | done |
| ABA-AG-01 | agents | Engine catalog HTTP endpoint | done |
| ABA-AG-02 | agents | MCP marketplace HTTP endpoint | done |
| ABA-AG-03 | agents | Preview and prompt optimization use runtime facade | done |
| ABA-BC-03 | birdcoder | Contract tests and workflow dependency registration | done |

## P5 Evolution Tasks

| ID | Owner | Title | Status | Notes |
| --- | --- | --- | --- | --- |
| ABA-BC-04 | birdcoder | BirdCoder PC consumes `@sdkwork/agents-app-sdk` | partial | Code-engine catalog service is live; full agent/session/message/task CRUD UI remains pending |
| ABA-AG-04 | agents | Agent task scheduling persistence and API surfaces | done | `agents.tasks.*` is live on Open/App/Backend surfaces |
| ABA-AG-05 | agents | Memory composition slot runtime mount | pending | Runtime integration with `@sdkwork/memory-app-sdk` pending |
| ABA-AG-06 | agents | Durable replayable message/run event stream | pending | `messages.create` streaming exists; independent replay/event stream remains pending |
| ABA-AG-07 | agents | Task-run projection | pending | `agents.taskRuns.list` and `ai_agent_task_run` depend on kernel `AgentRun` projection |
| ABA-BC-05 | birdcoder | Agent configuration UI in settings | pending | Depends on completing app SDK CRUD services |

See [TECH-36 Three-Layer Agent Platform Standard](./TECH-36-three-layer-agent-platform-standard.md) section 9.

## Verification Commands

```bash
node scripts/birdcoder-agents-integration-contract.test.mjs
node scripts/agents-birdcoder-alignment-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/agents-catalog-sdk-unwrapped-response-contract.test.ts
cargo test -p sdkwork-birdcoder-kernel-bridge
cargo test -p sdkwork-agents-runtime-facade
cargo test -p sdkwork-intelligence-agents-service --features http-axum --lib
```

Machine-readable tracker: `specs/agents-birdcoder-alignment.spec.json`.
