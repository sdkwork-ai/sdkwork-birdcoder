# @sdkwork/birdcoder-pc-shell-runtime

Domain: platform
Capability: pc-shell-runtime
Package type: react-package
Status: active

This README is the SDKWork module entrypoint for `@sdkwork/birdcoder-pc-shell-runtime`. The machine-readable component contract is `specs/component.spec.json`; canonical standards are under `../../../../../sdkwork-specs/`.

## Public API

- `.`

## Required SDK Surface

- None declared in `specs/component.spec.json`.

## Configuration

This package owns browser and desktop bootstrap ordering. It resolves the application ingress and platform gateway through typed runtime configuration, then injects those values through the shell bootstrap boundary. It owns no API, SDK generation, database, or credential authority.

## SaaS/Private/Local Behavior

Standalone browser and desktop runtimes use the application public ingress. Cloud runtimes keep application and platform connectivity planes distinct and fail closed when a required topology value is absent.

## Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module. Protected API and SDK access must use the generated SDK or approved service boundary declared in the component contract.

## Extension Points

Extension points are limited to public exports, runtime entrypoints, SDK clients, events, and config keys declared in `specs/component.spec.json`.

## Verification

- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root .`

## Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`. Update that contract before changing public integration behavior.
