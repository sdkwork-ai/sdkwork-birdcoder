# REQ-2026-0008 Codex Desktop Observable Parity

Status: in-progress
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-08-01
Specs: REQUIREMENTS_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, APP_PC_REACT_UI_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, FRONTEND_SPEC.md, UI_ARCHITECTURE_SPEC.md, TYPESCRIPT_CODE_SPEC.md, SECURITY_SPEC.md, TEST_SPEC.md

## Problem

BirdCoder is intended to provide the same observable coding-workbench behavior
as the supported ChatGPT/Codex desktop application while retaining SDKWork
ownership boundaries. The current repository contains substantial transcript,
shell, provider, and visual alignment work, but its parity contract is pinned
to an older installed Codex build and still records open owner-contract,
provider-control, Browser, Automation, remote-execution, and real-provider E2E
gaps. A static visual resemblance or one successful prompt is not sufficient
evidence of product parity.

## Required Outcome

- Maintain a versioned, reproducible reference inventory for the installed
  Codex desktop package, renderer archive, provider host, Browser runtime,
  relevant resource chunks, protocol schemas, and observable behaviors.
- Independently implement the observable Codex desktop shell, Session list,
  transcript, composer, tool activity, lifecycle, approval, question, Browser,
  Automation, remote, settings, and recovery behaviors through BirdCoder,
  sdkwork-agents, and sdkwork-kernel owner contracts.
- Preserve canonical SDKWork Session, Turn, Session Item, Interaction, Runtime
  Binding, generated SDK, authentication, and least-privilege host boundaries.
- Prove real message submission, provider streaming, final response,
  cancellation, restart recovery, approval continuation, user-input
  continuation, and authoritative Session rehydration through the product UI.
- Re-run reference discovery and invalidate stale parity claims whenever the
  installed Codex package, renderer package, provider host, Browser plugin, or
  protocol baseline changes.

## Non-Goals

- Copying, redistributing, or committing proprietary Codex bundle source,
  minified renderer code, artwork, credentials, or private data.
- Treating private symbol names, byte offsets, generated chunk names, or exact
  framework internals as a stable public API.
- Introducing Codex `Thread` domain terminology, raw provider transport, local
  SDK forks, or duplicated Agents persistence into BirdCoder.
- Claiming parity from screenshots, static fixtures, contract declarations, or
  version strings without executable behavior evidence.
- Weakening authentication, approval, filesystem, network, remote-host, or
  Browser permission controls to reproduce a visible interaction.

## Acceptance Criteria

1. A checked-in parity contract identifies the currently audited Codex package
   build, renderer version, provider version, Browser runtime version, artifact
   sizes and SHA-256 digests, protocol authority, audit date, and evidence
   policy. A local audit command fails when the installed reference drifts.
2. Reference analysis records independently authored mappings for every
   supported provider Session Item and desktop-synthetic presentation type,
   including visibility, aggregation, streaming, completion, error, and
   accessibility behavior. Unknown visible items degrade safely instead of
   disappearing or being reported as successful.
3. At desktop and narrow viewport fixtures, the shell, sidebar, Session rows,
   transcript lane, composer, Markdown, reasoning, tool rows, file changes,
   lifecycle notices, interaction cards, focus states, menus, scrolling, and
   responsive behavior pass reviewable visual regression with no overlap or
   horizontal overflow.
4. A signed-in user can create or select a canonical Agents Session, submit a
   text prompt through BirdCoder, observe the user message immediately, receive
   bounded live provider deltas, see the authoritative final response, reload
   the application, and recover the same completed Session through generated
   owner SDKs.
5. While a Turn is active, the composer exposes an accessible Stop action.
   Stopping invokes canonical Agents cancellation, reaches the exact provider
   execution, settles pending callbacks, waits for provider acknowledgement,
   and reconciles one authoritative cancelled terminal state before Send
   returns.
6. Command, file-change, permission, and automatic-review approvals preserve
   provider request identity, decision variants, Turn or Session scope, policy
   amendments, requested and granted permissions, and cancellation semantics
   end to end through Kernel, Agents persistence/OpenAPI/generated SDKs, and
   BirdCoder interaction UI.
7. User input preserves multiple stable question ids, headers, option metadata,
   free-form and secret behavior, answer arrays, automatic resolution timing,
   durable correlation, and exact provider response compilation. MCP
   elicitation, option picker, context picker, onboarding, and setup requests
   retain their typed request and response payloads.
8. Provider transport uses a pinned complete app-server v2 request/response
   union, exact string or numeric request ids, deterministic close failure,
   bounded reconnect, at-most-once continuation, typed host requests, and
   compatibility tests against the audited desktop baseline. Unknown requests
   fail visibly and do not get dropped while compatibility is claimed.
9. Session-bound Automations support create, schedule, run now, pause, resume,
   history, notification, cancellation, restart recovery, and canonical Session
   navigation through owner contracts and verified UI flows.
10. The embedded Browser supports Session-scoped navigation, history, capture,
    stop, isolation, site permission decisions, settings, and recovery through
    a governed Kernel host boundary. Studio iframe preview is not accepted as
    Browser parity evidence.
11. Remote Connections support authorized-device lifecycle, SSH host discovery,
    remote execution selection, connection failure/retry, and canonical
    Session continuation without exposing credentials or replacing Session
    identity with provider-native ids.
12. Focused contract tests, protocol fixtures, provider-adapter tests, PC
    typecheck, lint, architecture checks, production build, desktop and narrow
    visual regression, and credentialed real-provider E2E all pass against the
    same reference version.
13. The parity goal remains active until every required capability is
    `aligned-and-verified`, every presentation fixture has evidence, the real
    provider E2E is passed, and no open blocker or human-review gate remains.
    Partial feature completion never changes the overall goal to complete.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Security | Tokens, credentials, attestation payloads, secret answers, local paths, and private Browser state remain in approved owner or host boundaries and are redacted from artifacts, logs, screenshots, and persisted interaction projections. |
| Privacy | Reference analysis records hashes, paths, protocol shapes, labels, layout measurements, and observable behavior only; it does not commit proprietary bundle contents or user data. |
| Reliability | Provider requests, cancellations, approvals, answers, reconnects, and recovery are correlated durably and resolved at most once without inventing success after ambiguous transport failure. |
| Performance | Transcript, output, attachment, Browser, request, reconnect, and reference-scanning work remains bounded and retains existing virtualization and pagination contracts. |
| Accessibility | Keyboard operation, focus restoration, semantic controls, status announcements, reduced motion, contrast, and narrow-layout behavior are verified for every critical workflow. |
| Reproducibility | The installed reference can be re-audited with one non-mutating command, and every checked-in assertion traces to a versioned artifact or independently authored fixture. |

## Traceability

- [Product requirements](../prd/PRD.md)
- [Provider-neutral Session transcript](REQ-2026-0004-provider-neutral-session-transcript.md)
- [Hybrid local and cloud Agent execution](REQ-2026-0006-hybrid-local-cloud-agent-execution.md)
- [Durable Turn input queue](REQ-2026-0007-durable-turn-input-queue.md)
- [Codex desktop parity contract](../../../specs/codex-desktop-parity.spec.json)
- [Agents and BirdCoder alignment contract](../../../specs/agents-birdcoder-alignment.spec.json)
- [Kernel and BirdCoder alignment contract](../../../specs/kernel-birdcoder-alignment.spec.json)

## Verification

```bash
node scripts/codex-desktop-reference-audit.mjs
node scripts/codex-desktop-parity-contract.test.mjs
pnpm check:provider-protocols
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm --dir apps/sdkwork-birdcoder-pc test:e2e
pnpm lint
pnpm check:arch
pnpm --dir apps/sdkwork-birdcoder-pc build
git diff --check
```
