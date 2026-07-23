# SDKWork BirdCoder Flutter Mobile Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-flutter-mobile
Updated: 2026-07-22
Specs: ARCHITECTURE_DECISION_SPEC.md, DOCUMENTATION_SPEC.md, FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md

This document narrows the root
[technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
to the Flutter Android and iOS runtime.

## Composition

The application bootstrap owns typed runtime configuration, secure Session
storage, one TokenManager, and concrete SDK clients. Feature pages receive the
composed client set through `AppProvider`. The mobile core is an authored
service/facade layer; generator-owned code remains under
`generated/server-openapi`.

BirdCoder workbench calls use the local Dart consumer generated from the root
39-operation BirdCoder App API authority. AI workflows use
`sdkwork_agents_app_sdk` directly through `agents_session_service.dart`. The
consumer workspace does not generate BirdCoder Backend API, Open API, Agents,
IAM, or other dependency operations.

## Session And Persistence Boundary

Agents owns Session, Turn, Session Item, Interaction, runtime binding, artifact,
and checkpoint facts. Flutter stores only IAM credential state in native secure
storage and keeps assistant view state in memory. Stored credentials are
validated through the generated IAM current-session operation; there is no raw
HTTP IAM probe or fail-open fallback.

AI Session Items and human IM Messages are distinct business facts. The mobile
assistant does not construct an IM client because this surface currently has no
human communication feature.

## Security

Authenticated App SDKs share the same TokenManager. Runtime config contains no
live credentials. Provider credentials and target-private paths do not cross
into Dart UI code. SDK/session failures fail closed and clear invalid local
credentials.

## Verification

    node scripts/flutter-sdk-assembly-contract.test.mjs
    node scripts/flutter-mobile-agents-session-contract.test.mjs
    node scripts/flutter-mobile-auth-surface-contract.test.mjs
    node scripts/flutter-iam-session-storage-contract.test.mjs
    flutter test
    dart analyze

## Canonical References

- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Root PRD](../../../../../docs/product/prd/PRD.md)
