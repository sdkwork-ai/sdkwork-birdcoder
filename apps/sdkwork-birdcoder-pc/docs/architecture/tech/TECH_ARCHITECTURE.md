# SDKWork BirdCoder PC Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-16
Specs: DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md

This document narrows the root architecture to the PC surface. It does not
replace the root [technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md).

## PC Session Boundary

The renderer and PC application services select a provider/model pair, consume
the composed @sdkwork/birdcoder-app-sdk facade for app API operations, and
project canonical BirdCoder session state. They do not import Provider SDKs.

For the P0 providers codex, claude-code, gemini, and opencode, the kernel bridge
and codeengine adapter own Provider execution and native-session translation.
The PC surface creates a logical codingSessionId; it retains the immutable
session engineId and modelId. When a provider-native conversation is bound,
the PC reads its raw nativeSessionId plus engineId through the authenticated
BirdCoder App API and maps the result back to the logical session. The App API
resolves a server-owned project execution root only after project, workspace,
organization, and user authorization succeeds.

A Tauri folder mount remains a local device capability for filesystem and
terminal operations. It is not a provider-native session authorization grant.
The Tauri host exposes no native-session list/detail command and never accepts
a renderer-supplied project root for provider discovery. When the server has no
authorized project execution root, native session discovery fails closed rather
than falling back to a local path.

## Canonical References

- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [Engine SDK integration](../../../../../docs/reference/engine-sdk-integration.md)
- [API reference](../../../../../docs/reference/api-reference.md)
