# SDKWork Birdcoder PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-06-26
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md

## Document Map

- [PRD-01 基线审计](PRD-01-baseline-audit.md)
- [PRD-01 产品设计与需求范围](PRD-01-productdesignrequirementsscope.md)

## 1. Background And Problem

BirdCoder is the SDKWork AI coding IDE product. It must deliver authenticated workspace,
chat/agent, code editing, terminal, skills, and deployment surfaces across PC web/desktop,
with H5 and Flutter mobile companions, backed by a contract-complete Rust API server.

Detailed product scope lives in the linked PRD shards below.

## 2. Target Users

- Individual developers using BirdCoder locally or against a managed SDKWork tenant
- Team leads operating shared workspaces, projects, and deployments
- Platform operators publishing governed releases and running enterprise Kubernetes deployments

## 3. Goals

- Ship a contract-governed IDE product aligned with sdkwork-specs across PC, mobile, API, and release surfaces
- Keep SDK integration, IAM, tenant isolation, and OpenAPI parity verifiable in CI
- Reach governed commercial release with checksum-backed artifacts, SBOM, and signing evidence

## 4. Scope

In scope: PC web/desktop shell, Rust standalone-gateway, OpenAPI app/backend routes, IAM federation,
workspace realtime, operator runbooks, release rehearsal, H5/Flutter route parity.

Out of scope until post-launch: public catalog install with synthetic artifacts, full PC feature
parity on mobile, admin/console product shells beyond configuration stubs.

## 5. Non-Goals

- Replacing sdkwork-specs with repository-local copies
- Hand-written HTTP clients bypassing generated SDK families
- Shipping enabled install packages before `release:assert-ready` on real artifacts

## 6. Success Metrics

- `pnpm lint`, `pnpm run check:arch`, and `pnpm run check:server` green on main
- OpenAPI defer registry reports zero deferred operations against the full contract snapshot
- All `sdkwork.app.config.json` surfaces remain DRAFT/preLaunch until first governed release
- First real release produces signing/SBOM/checksum evidence and enables install packages

## 7. Release Phases

1. Private PC beta with standalone/cloud server profiles
2. Enterprise Kubernetes with PostgreSQL HA overlay and backup drills
3. Governed public release with real artifacts and unified manifest truth
4. Mobile store lanes after Flutter/iOS release CI and catalog assets are complete

## 8. Dependencies

- sdkwork-specs standards dictionary
- sdkwork-iam, sdkwork-appbase, sdkwork-web-framework, sdkwork-database lifecycle crates
- Generated `@sdkwork/birdcoder-app-sdk` families under application `sdks/`

## 9. Open Questions

- iOS Capacitor headless assemble smoke timing on macOS CI runners
