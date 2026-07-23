# SDKWork BirdCoder H5 Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-h5
Updated: 2026-07-22
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_H5_ARCHITECTURE_SPEC.md

This document narrows the root [BirdCoder PRD](../../../../../docs/product/prd/PRD.md)
to the H5 and Capacitor surface.

## Surface Scope

The H5 client provides mobile project navigation, the assistant workflow,
authentication, and settings while preserving the same domain ownership as the
PC surface. It consumes BirdCoder workbench operations through the BirdCoder
App SDK and AI workflows through the Agents App SDK.

The assistant surface selects or creates an Agents Session, lists paginated
Session Items, and submits Turns. Session and transcript facts remain in
`sdkwork-agents`; H5 owns only disposable presentation state. Human IM Message
semantics are not used for AI transcript items.

## Non-Goals

- No H5-owned database, Session authority, transcript cache, or copied OpenAPI.
- No provider SDK, native provider-session, raw HTTP, or manual auth headers in
  feature packages.
- No assumption that a browser or Capacitor path is a server execution root.
- No IM dependency unless a separate human communication feature is introduced.

## Acceptance

Authenticated SDKs share the application TokenManager, SDK base URLs come from
typed runtime configuration, list operations remain bounded and paginated, and
host capabilities are injected through H5/Capacitor adapters. Failures surface
explicitly; fake success and compatibility paths are prohibited.

## Canonical References

- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
