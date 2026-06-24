# Tauri config templates

BirdCoder desktop bundle metadata lives in `packages/sdkwork-birdcoder-pc-desktop/src-tauri/`.

Use this directory for non-secret Tauri template overrides that operators may copy into host-local config:

- `tauri.bundle.template.json` — documents bundle identifiers and icon paths referenced by release automation.
- Platform-specific overlays remain in `src-tauri/tauri.windows.conf.json`, `tauri.macos.conf.json`, and `tauri.linux.conf.json`.

Do not store signing keys, updater private keys, or production secrets in this folder.
