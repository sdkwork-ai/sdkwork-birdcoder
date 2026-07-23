# SDKWork BirdCoder PC Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-23
Specs: DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, APP_RUNTIME_TOPOLOGY_SPEC.md

This document narrows the root
[technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
to the PC surface. It is not a second architecture authority.

## Composition Boundary

The shell owns routing, runtime configuration, the shared TokenManager, SDK
client construction, and browser/Tauri host adapters. Feature packages receive
services or typed ports through injection. They do not construct SDK clients,
read environment variables, assemble authentication headers, or import
generated transport internals.

Remote workbench operations use the composed BirdCoder App SDK. AI workflows
use the Agents App SDK through the infrastructure `AgentSessionService`. Skills,
Prompts, Documents, Drive, IAM, and other dependency capabilities use their
owner SDK families. BirdCoder-generated transport contains only BirdCoder-owned
App API operations.

## SDK Connectivity Planes

`application.public-ingress` is the exclusive base URL for the BirdCoder App
SDK. `platform.api-gateway` is the default base URL for Agents, Skills,
Documents, Prompts, IAM, Drive, Messaging, Membership, and Order SDKs. An
owner-specific dependency override may replace the platform URL for one SDK;
the BirdCoder application URL is never a dependency fallback.

Browser development maps the platform plane to the same-origin
`/__sdkwork/platform` path and Vite forwards it to the server-only platform
target after removing the prefix. `/app` remains bound to BirdCoder. Desktop
uses the embedded Tauri address only for BirdCoder and requires a separate
direct platform gateway. Invalid or missing topology fails before feature
services, session refresh, or commercial SDK bootstrap.

## Agent Session Boundary

The canonical lifecycle is:

    Agents Project -> Session -> Turn -> Session Item -> Interaction

The PC surface keeps the Agents identifiers returned by the owner SDK and maps
owner records into disposable UI views. It creates no BirdCoder Session id,
transcript table, persistent projection, provider runtime, or native-session
authority. Provider execution and native-session translation remain behind
Agents and Kernel owner adapters.

## Host And Runtime Location Boundary

A Tauri folder selection is current-device capability material. Distributed
execution uses an authorized BirdCoder `ProjectRuntimeLocation` id; absolute
paths remain encrypted and target-private. Browser code cannot turn a local
directory handle, process CWD, or provider-reported CWD into remote execution
authority. Unsupported resolution fails closed.

## Verification

    pnpm check:agents-birdcoder-alignment
    pnpm check:api-transport-standard
    pnpm check:app-composition
    pnpm check:desktop
    pnpm typecheck

## Canonical References

- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [API reference](../../../../../docs/reference/api-reference.md)
