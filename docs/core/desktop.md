# Desktop Runtime

BirdCoder desktop delivery is a Tauri-based desktop host with packageable artifacts, installer smoke, and packaged-launch smoke.

## Runtime shape

- renderer UI from `sdkwork-birdcoder-web`
- native shell from `sdkwork-birdcoder-desktop/src-tauri`
- release orchestration from `scripts/run-desktop-release-build.mjs`
- native installer artifacts under `desktop/<platform>/<arch>/installers/<bundle>/...`

The desktop renderer uses the same project and app-SDK services as Browser.
Its only additional responsibility is the host capability boundary: a selected
folder stays inside the Tauri filesystem adapter and the host-private
`local_store_*` SQLite KV registry. The registry is OS-account-private and
subject-scoped, but its path values are plaintext at rest. They must not be
sent to the BirdCoder server, written to remote project metadata, or presented
as a remote workspace root.

The `installers/<bundle>` directory segment is part of the desktop release contract. It preserves the Tauri bundle type and prevents same-name installers from different bundle generators from overwriting each other during packaging or publication.

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

## Desktop host alignment

BirdCoder aligns to the SDKWork desktop host standard for build and release architecture, making it compatible with the same CI, packaging, and smoke-verification pipelines used across SDKWork application surfaces.
