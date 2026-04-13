# Desktop Runtime

BirdCoder desktop delivery follows the same release-family role as Claw Studio: a Tauri-based desktop host with packageable artifacts, installer smoke, and packaged-launch smoke.

## Runtime shape

- renderer UI from `sdkwork-birdcoder-web`
- native shell from `sdkwork-birdcoder-desktop/src-tauri`
- release orchestration from `scripts/run-desktop-release-build.mjs`

## Verification

Run the desktop gate from the workspace root:

```bash
pnpm check:desktop
```

For release validation, BirdCoder keeps the same packaged installer and packaged-launch smoke stages inside the reusable GitHub workflow. Desktop startup evidence remains a local/manual release gate:

```bash
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch
pnpm release:smoke:desktop-startup
```

## Product difference

BirdCoder does not copy Claw Studio's OpenClaw runtime semantics. The desktop host only aligns to the same build and release architecture shape.
