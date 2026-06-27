> Migrated from `docs/release/release-2026-05-06-01.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Publishes the first GitHub-backed BirdCoder release from the current `main` branch after confirming that no earlier GitHub Release or release tag exists for this repository.
- Carries forward the unpublished release chain through `release-2026-04-28-01`, including the pending history from the 2026-04-08 through 2026-04-28 release notes.
- Hardens BirdCoder runtime activity surfaces across Code, Studio, Shell, Settings, Identity, Terminal, project/session inventory, transcript loading, file search, provider-backed persistence, and release governance.
- Preserves the multi-window programming standard from `release-2026-04-28-01` while syncing the lockfile importer for the current workspace package layout.
- Remediates the active problem list by tightening provider adapters, official SDK runtime selection, CLI fallback contracts, user storage, draft persistence, terminal runtime handling, and problem-list governance.
- Removes retired compatibility surfaces including the retired VIP route option, Codex compatibility debt, and the unused Tauri dialog permission path.
- Flattens chat inline change display so Universal Chat activity summaries and task progress render against governed transcript behavior without nested, duplicated presentation.
- Adds a browser QRCode alias shim and contract so Vite development and production resolution use the browser-safe QRCode entry consistently.
- Confirms shared SDK release dependency mode still uses GitHub-backed sources in release while local development keeps sibling repository links.
- Switches GitHub Actions shared SDK materialization to passwordless SSH for private sibling repositories, while keeping the release source registry on GitHub URLs and keeping token-based HTTPS as an explicit fallback path.
- Aligns the independent `sdkwork-ui` repository for git dependency installs by correcting published type entry paths and narrowing timeline status alias typing before this BirdCoder release.
- Fixes multiple GitHub Actions release verification failures by resolving shared SDK sources, aliases, React compatibility, Rust toolchain PATH, Tauri SQLite path resolution, and terminal dependencies for clean Linux release environments.
- Aligns CI and reusable release jobs with the SDKWork baseline by exposing checked-out POSIX `sdkwork-run-node` and `sdkwork-run-pnpm` command wrappers before pnpm lifecycle scripts run on Linux, macOS, or Git Bash based runners.
- Hardens the release parity contract so BirdCoder compares release workflow shape against the committed SDKWork baseline instead of unrelated dirty sibling worktree state.
- Follows the published `sdkwork-specs` release SDK build baseline by pinning BirdCoder CI and reusable release Rust setup to `dtolnay/rust-toolchain@1.90.0` and adding CI/release contracts that reject drift.
- Fixes additional GitHub Actions release verification failures by making the Tauri dev binary unlock check, release-flow runner contract, Codex transport detection, and Tauri shell source compile consistently across Linux release runners and Windows development hosts.

## Scope

Extensive scope covering CI workflows, release scripts, Docker deployment, SDK materialization, Rust toolchain, Tauri CLI, engine contracts, and quality gates. See the migrated source file for full scope details.

## Verification

- `pnpm check:ci-flow`
- `pnpm check:release-flow`
- `pnpm check:governance-regression`
- `pnpm check:quality:release`
- Local release rehearsal flow

## Notes

- The release chain carries forward unpublished history from earlier 2026-04 release notes through the first GitHub Release.
- CI/release workflow wrappers are now portable across Linux, macOS, and Windows runners.
- Shared SDK git-mode dependencies are materialized over SSH during release, with token-based HTTPS as fallback.
