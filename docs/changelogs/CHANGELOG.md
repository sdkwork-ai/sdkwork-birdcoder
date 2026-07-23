# BirdCoder Changelog

Status: active
Owner: SDKWork maintainers
Specs: `DOCUMENTATION_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `DEPLOYMENT_SPEC.md`

## Unreleased

### Changed

- Converged BirdCoder on the coding-workbench bounded context with exactly ten
  `studio_*` tables, 39 App API operations, and no BirdCoder Backend or Open API.
- Moved AI Session, Turn, Session Item, Interaction, Runtime Binding, artifact,
  checkpoint, and provider-execution authority to `sdkwork-agents`.
- Moved all Skill authority to `sdkwork-skills` and kept human IM Conversation
  and Message semantics separate from Agents assistant content.
- Standardized dependency consumption on canonical generated SDK families and
  one global `TokenManager`; removed copied APIs, raw HTTP, local SDK forks,
  compatibility facades, projections, shadow tables, and dual writes.
- Established target-scoped `ProjectRuntimeLocation` as the only executable
  project-root authority, with write-only encrypted paths and stable-ID Agents
  Session Runtime Bindings.
- Replaced the TypeScript PC server entrypoint with the canonical Rust
  `sdkwork-api-birdcoder-standalone-gateway`.
- Consolidated pre-launch release notes and documentation on the current
  architecture; formal release history begins with the first signed release.

### Verification

- Domain ownership, database parity, API, pagination, route, layering, SDK,
  package governance, desktop, H5, Flutter, documentation, release, and
  production-operation gates must all pass before this section is released.
