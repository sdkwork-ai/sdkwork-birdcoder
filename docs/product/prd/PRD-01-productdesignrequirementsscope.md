# PRD-01 Product Design And Requirement Scope

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-07-08
Parent: [PRD.md](PRD.md)
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md

This shard defines BirdCoder's product positioning, target users, functional scope, design requirements, and non-functional requirements for the first governed release baseline.

## 1. Product Positioning

SDKWork BirdCoder is a professional AI coding collaboration platform. It combines SDKWork contract governance, generated SDKs, IAM, tenant isolation, release evidence, and a multi-agent coding workbench across PC, H5, and Flutter roots.

The root `sdkwork.app.config.json` remains `DRAFT` / `preLaunch`. This PRD describes the governed release target, not a public launch claim.

## 2. Target Users

- Professional developers who use VS Code, Cursor, Codex, Claude Code, OpenCode, or similar coding agents and need local or managed-tenant coding sessions.
- Enterprise development teams that need shared workspaces, project governance, deployment control, auditability, and tenant isolation.
- Education and enablement teams that need controlled AI coding environments.
- SDKWork platform operators that need repeatable release, compliance, and commercial readiness evidence.

## 3. Product Scope

### 3.1 Core Workbench

- AI coding sessions with multi-turn conversation, tool calls, terminal integration, file/workspace context, git overview, and projection timeline.
- Workbench modules for code, studio, skills, templates, settings, and project/workspace management.
- Server-side Rust route/service/repository implementation with SQLite default and PostgreSQL HA overlay.

### 3.2 Engine And Agent Platform

P0 code-agent engines:

- Codex.
- Claude Code.
- Gemini CLI.
- OpenCode.

Execution path:

```text
BirdCoder workbench
  -> sdkwork-birdcoder-kernel-bridge
  -> sdkwork-agents-runtime-facade
  -> sdkwork-kernel provider binding
  -> provider SDK/CLI/process runtime
```

Three-layer model:

| Layer | Repository | BirdCoder Relationship |
| --- | --- | --- |
| Kernel | `sdkwork-kernel` | SPI/provider owner; BirdCoder does not depend on it directly |
| Agents | `sdkwork-agents` | Sole agent business entry: runtime facade and `@sdkwork/agents-app-sdk` |
| Product | `sdkwork-birdcoder` | Coding-session projection, workbench UX, code-engine catalog, release posture |

Autonomous providers and framework-level agents:

- OpenClaw has an experimental SDK/gateway binding in kernel and stays outside BirdCoder P0 until conformance and product support are complete.
- Hermes has a process/IPC binding shape and stays outside BirdCoder P0 until conformance and product support are complete.
- Rig is a Rust-native framework/provider baseline for infrastructure experiments, not a default BirdCoder P0 product engine.

### 3.3 Client Roots

- PC: `apps/sdkwork-birdcoder-pc/`, React + Tauri, primary implementation surface.
- H5: `apps/sdkwork-birdcoder-h5/`, mobile web and Capacitor shell, route-parity companion.
- Flutter Mobile: `apps/sdkwork-birdcoder-flutter-mobile/`, mobile companion root, release lane pending further CI hardening.

All client roots must follow `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` for package roles, route identity, i18n keys, SDK surfaces, and host-adapter boundaries.

### 3.4 IAM

- Dual-token JWT model with tenant, organization, user, and session context.
- Appbase IAM runtime owns login, registration, organization selection, AuthGate, logout, current-user, and session lifecycle.
- Product modules do not parse tokens, assemble auth headers, or define local auth routes.

### 3.5 Commercial Capabilities

- Membership plans: free, pro, enterprise.
- Orders, invoices, payments, usage metering, API key management, and notifications.
- Release-governed install packages with checksum, signature, SBOM, and provenance evidence.

## 4. Product Design Requirements

- The PC workbench must feel like a professional developer tool, with dense but readable navigation, fast engine switching, and predictable session management.
- Engine and agent configuration must be surfaced through services backed by generated SDKs, not by UI-local HTTP calls.
- Settings must separate code engines, model selection, MCP/skills/prompts, memory/knowledge composition, security policy, and release/deployment configuration.
- Mobile companions must preserve workflow identity and SDK boundaries even when UI parity is intentionally narrower.

## 5. Non-Functional Requirements

- Performance: key interactive paths target p95 under 100 ms where local data is available; list/search APIs must use bounded server-side pagination.
- Security: sandbox, RBAC, IAM dual-token validation, audit events, and Tauri host capability allowlists follow root security specs.
- Reliability: release target SLO is 99.9% for managed cloud API surfaces after public launch.
- Observability: logs, metrics, traces, health checks, release evidence, and operator runbooks follow `OBSERVABILITY_SPEC.md` and `HEALTH_CHECK_SPEC.md`.
- SDK governance: all app API consumption uses composed generated SDK packages.

## 6. Release Plan

1. PC private beta with standalone and cloud server profiles.
2. Enterprise K8s with PostgreSQL HA overlay and backup drills.
3. Agent platform hardening: full `@sdkwork/agents-app-sdk` service/UI adoption, task-run projection, memory runtime mount, replayable message/run event stream.
4. Governed public release with real artifacts and unified manifest truth.
5. Mobile store lanes after Flutter/iOS CI and catalog assets are complete.

## 7. Open Questions

- Final schedule for splitting large server/UI packages into smaller capability packages after agent SDK adoption.
- Final UX for autonomous OpenClaw/Hermes optional exposure after kernel conformance passes.
