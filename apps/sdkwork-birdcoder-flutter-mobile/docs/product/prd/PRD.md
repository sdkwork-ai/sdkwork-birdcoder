# SDKWork BirdCoder Flutter Mobile Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-flutter-mobile
Updated: 2026-07-22
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md

This document narrows the root [BirdCoder PRD](../../../../../docs/product/prd/PRD.md)
to Android and iOS delivery through Flutter.

## Surface Scope

Flutter mobile provides authenticated access to BirdCoder workbench context and
the AI assistant workflow. BirdCoder-owned remote operations use the generated
Dart App SDK consumer. Assistant history and execution use the canonical Agents
Dart App SDK.

The assistant creates or selects an Agents Session, retrieves paginated Session
Items, and submits a Turn through the Agents streaming operation. The mobile UI
maps those records into disposable view objects; it creates no BirdCoder
Conversation, Message, Session, or transcript authority.

## Product Boundaries

- IAM credentials use the shared mobile TokenManager and native secure storage.
- Human IM Conversation and Message facts remain separate from AI Session Items.
- Provider SDKs, native provider sessions, and execution credentials never enter
  the Flutter feature layer.
- Backend API and Open API consumers are absent because BirdCoder owns neither
  surface.

## Acceptance

The Flutter client must use generated owner SDKs, canonical request/response
envelopes, bounded pagination, secure credential storage, and fail-closed
Session validation. Raw HTTP auth probes, local SDK forks, copied DTOs, mock
success, and persistent transcript projections are prohibited.

## Canonical References

- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
