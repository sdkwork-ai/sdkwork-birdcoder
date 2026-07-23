# SDKWork BirdCoder H5 Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-h5
Updated: 2026-07-22
Specs: ARCHITECTURE_DECISION_SPEC.md, DOCUMENTATION_SPEC.md, APP_H5_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md

This document narrows the root
[technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
to the React/Vite H5 and Capacitor runtime.

## Composition

The H5 shell owns routes and providers. H5 core owns typed runtime config, the
global TokenManager, and SDK client factories. Feature packages receive service
ports; they do not construct clients or access generated transport internals.

BirdCoder App API calls use `@sdkwork/birdcoder-app-sdk`. Assistant operations
use `@sdkwork/agents-app-sdk`; the core assistant service calls Agents Session,
Session Item, and Turn resources with bounded pagination. Dependency operations
are not regenerated into the BirdCoder SDK family.

## Data And Message Semantics

H5 persists no BirdCoder business database. Browser session storage is limited
to governed IAM credential state. AI transcript items are Agents Session Items,
while human Conversation and Message facts belong to IM. The H5 assistant route
does not create an IM persistence or projection boundary.

## Security And Runtime

SDK authentication is supplied by the shared TokenManager. Public runtime
configuration contains base URLs and non-secret flags only. Capacitor device
capabilities are accessed through typed host adapters, and no local path is
accepted as remote execution authority.

## Verification

    node scripts/h5-architecture-boundary-contract.test.mjs
    node scripts/h5-sdk-assembly-contract.test.mjs
    node scripts/h5-app-session-persistence-contract.test.mjs
    pnpm typecheck

## Canonical References

- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Root PRD](../../../../../docs/product/prd/PRD.md)
