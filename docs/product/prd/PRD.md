# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-07-08
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md

## Document Map

- [PRD-01 baseline audit](PRD-01-baseline-audit.md)
- [PRD-01 product design and requirement scope](PRD-01-productdesignrequirementsscope.md)
- [PRD-02 three-layer agent platform](PRD-02-three-layer-agent-platform.md)

## 1. Background And Problem

BirdCoder is the SDKWork AI coding IDE product. It must deliver authenticated workspace, chat/agent, code editing, terminal, skills, commerce, deployment, and release governance surfaces across PC web/desktop, with H5 and Flutter companion roots. The product is backed by a contract-complete Rust standalone gateway and must stay aligned with `sdkwork-specs`.

The agent platform is now a three-layer system:

- `sdkwork-kernel` defines standardized SPI, provider bindings, code-kernel abstractions, and runtime mechanisms.
- `sdkwork-agents` owns business persistence, managed agent APIs, generated SDKs, session/message/task records, runtime facade, and composition with memory/knowledge/skills/prompts/drive/MCP modules.
- `sdkwork-birdcoder` is the product consumer. All agent product operations go through `sdkwork-agents`; BirdCoder must not call `sdkwork-kernel` or `sdkwork-agent-provider-*` directly.

## 2. Target Users

- Individual developers using BirdCoder locally or against a managed SDKWork tenant.
- Team leads operating shared workspaces, projects, coding sessions, and deployments.
- Platform operators publishing governed releases and running enterprise Kubernetes deployments.
- SDKWork platform engineers validating kernel, agents, SDK, API, and release governance.

## 3. Goals

- Ship a contract-governed IDE product aligned with sdkwork-specs across PC, mobile, API, SDK, data, and release surfaces.
- Support multiple code agents through a pluggable kernel/provider model while keeping BirdCoder coupled only to `sdkwork-agents`.
- Keep SDK integration, IAM, tenant isolation, pagination, OpenAPI parity, and commercial readiness verifiable in CI.
- Reach governed commercial release with checksum-backed artifacts, SBOM, signing evidence, and honest preLaunch manifest state.

## 4. Scope

In scope:

- PC web/desktop shell, Rust standalone gateway, OpenAPI app/backend routes, IAM federation, workspace realtime, operator runbooks, release rehearsal, H5/Flutter route parity.
- P0 code-agent engines: Codex, Claude Code, Gemini CLI, and OpenCode through `sdkwork-kernel` provider bindings and `sdkwork-agents-runtime-facade`.
- `sdkwork-agents` managed agent APIs: Open API 27 operations, App API 35 operations, Backend API 33 operations, 95 total operations.
- BirdCoder service adoption of `@sdkwork/agents-app-sdk` for app-side agent catalog and future agent/session/message/task workflows.

Out of scope until later governed phases:

- Public catalog install with synthetic artifacts.
- Full PC feature parity on H5/Flutter mobile.
- Autonomous OpenClaw/Hermes product exposure before conformance, feature flag, and operational runbook are complete.
- Direct BirdCoder dependency on kernel/provider internals.

## 5. Non-Goals

- Replacing sdkwork-specs with repository-local copies.
- Hand-written HTTP clients bypassing generated SDK families.
- Shipping enabled install packages before `release:assert-ready` on real artifacts.
- Defining agent business database schema inside `sdkwork-kernel`.
- Treating experimental autonomous provider manifests as production product capability.

## 6. Success Metrics

- `pnpm lint`, `pnpm run check:arch`, `pnpm run check:server`, and agent/kernel alignment checks pass on main.
- OpenAPI defer registry reports `162 / 162` implemented operations and `0` deferred operations for BirdCoder.
- `sdkwork-agents` API specification reports Open 27, App 35, Backend 33, Total 95 operations.
- All app-side agent HTTP consumption uses composed SDK imports such as `@sdkwork/agents-app-sdk`; no raw agents app-api calls exist.
- All `sdkwork.app.config.json` package surfaces remain DRAFT/preLaunch until the first governed release publishes real artifacts.
- First real release produces signing, SBOM, checksum, and release rehearsal evidence before install packages are enabled.

## 7. Release Phases

1. Private PC beta with standalone/cloud server profiles and P0 code-agent execution.
2. Enterprise Kubernetes with PostgreSQL HA overlay, backup drills, and operator runbooks.
3. Agent platform P5 hardening: agents app SDK adoption, task-run projection, memory runtime mounting, and message/run event streaming.
4. Governed public release with real artifacts and unified manifest truth.
5. Mobile store lanes after Flutter/iOS release CI and catalog assets are complete.

## 8. Dependencies

- `sdkwork-specs` standards dictionary.
- `sdkwork-kernel` for agent/code kernel SPI and provider plugin bindings. BirdCoder consumes it only through `sdkwork-agents-runtime-facade`.
- `sdkwork-agents` for the business agent layer, `sdkwork-agents-runtime-facade`, 95 HTTP operations, and `@sdkwork/agents-app-sdk`.
- `sdkwork-iam`, `sdkwork-appbase`, `sdkwork-web-framework`, and `sdkwork-database` lifecycle crates.
- Generated `@sdkwork/birdcoder-app-sdk` families under application `sdks/`.
- Sibling composition modules through agents slots: `sdkwork-memory`, `sdkwork-knowledgebase`, `sdkwork-skills`, `sdkwork-prompts`, `sdkwork-drive`, and MCP marketplaces.

## 9. Open Questions

- iOS Capacitor headless assemble smoke timing on macOS CI runners.
- Final product UX for agent configuration, session/message management, memory mounting, and task-run history after `@sdkwork/agents-app-sdk` consumption reaches full CRUD parity.
