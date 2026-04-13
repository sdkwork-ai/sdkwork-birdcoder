# BirdCoder Claw Parity Design

## Goal

Align `apps/sdkwork-birdcoder` with the `apps/claw-studio` architecture standard while preserving BirdCoder as a super AI IDE product. The parity target is architecture and delivery shape, not feature cloning.

## Parity Principles

1. Keep BirdCoder business modules (`code`, `studio`, `terminal`, `skills`, `templates`, `user`, `auth`) intact.
2. Match Claw Studio on foundational layers: host runtime, distribution, infrastructure, i18n, release flow, CI flow, deployment flow, and GitHub release publishing shape.
3. Prefer extracting existing logic into standard packages over inventing empty wrappers.
4. Any new package must either own a clear responsibility or define a stable future extension point.

## Target Architecture

### Foundation packages

- `sdkwork-birdcoder-core`: shared boot/runtime primitives.
- `sdkwork-birdcoder-types`: shared contracts.
- `sdkwork-birdcoder-i18n`: i18n bootstrap and locale resources.
- `sdkwork-birdcoder-infrastructure`: service interfaces, mock adapters, local folder bridge, runtime utilities.
- `sdkwork-birdcoder-ui`: shared UI primitives.
- `sdkwork-birdcoder-commons`: React providers, hooks, event bus, composition helpers.

### Host/runtime packages

- `sdkwork-birdcoder-shell`: application shell and mode-agnostic runtime composition.
- `sdkwork-birdcoder-host-core`: host descriptor and unified API boundary metadata.
- `sdkwork-birdcoder-host-studio`: native host-studio placeholder aligned with Claw Studio package topology.
- `sdkwork-birdcoder-web`: web host entry.
- `sdkwork-birdcoder-desktop`: Tauri desktop host entry.
- `sdkwork-birdcoder-server`: server host entry.
- `sdkwork-birdcoder-distribution`: distribution manifests for region/release behavior.

### Delivery layers

- `deploy/docker` and `deploy/kubernetes`: packaging inputs.
- `.github/workflows`: CI and release orchestration.
- `scripts/release/*`: plan, package, smoke, finalize, and release note rendering.
- `docs/`: product and architecture docs site for release artifacts.

## Implementation Notes

- Move BirdCoder i18n initialization out of `commons` into `sdkwork-birdcoder-i18n`, then initialize it from shell providers.
- Move service interfaces, mock implementations, and local folder/runtime bridge helpers into `sdkwork-birdcoder-infrastructure`, with `commons` re-exporting only compatibility surfaces needed by current business modules.
- Add release finalization and notes rendering so GitHub publish flow can mirror the Claw Studio `prepare -> verify -> package -> publish` lifecycle.
- Add CI/release contract checks so parity is enforced by scripts, not memory.

## Out of Scope

- Copying Claw Studio business modules or routes.
- Replacing BirdCoder UI or product flows.
- Performing live GitHub release publication or push from this local session without valid auth.
