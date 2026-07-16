# Desktop Runtime

BirdCoder desktop delivery is a Tauri-based host with packageable artifacts,
installer smoke, and packaged-launch smoke.

## Runtime Shape

- renderer UI from sdkwork-birdcoder-web
- native shell from sdkwork-birdcoder-desktop/src-tauri
- release orchestration from scripts/run-desktop-release-build.mjs
- native installer artifacts under desktop/<platform>/<arch>/installers/<bundle>

The desktop renderer uses the same Project and app-SDK services as Browser.
The host-specific responsibility is local capability materialization:

1. A desktop import selects a native directory and binds it to the current
   device/subject.
2. The app registers a protected ProjectRuntimeLocation using a write-only
   path input. The server encrypts the path and app API responses do not reveal
   it.
3. The native binding persists only as current-device capability material. It
   is required to resolve a local terminal cwd and prove the desktop owns the
   location.
4. A terminal, build, or Git action resolves the project and relevant
   capability through the injected runtime-location service. Worktree is a Git
   action, not a separate capability or preference. The action uses the
   canonical native root only when that service returns a local resolved state.
5. Missing, cancelled, unsupported, or unavailable resolution fails the
   action. The desktop does not ask the server for a path reveal and does not
   fall back to its process current directory.

The current local binding is scoped to the active IAM realm and subject. It
may be plaintext in host-private local storage; that is separate from the
encrypted server persistence used for the authoritative runtime location.
Desktop documentation must not claim local-cache encryption unless a secure
store/keychain implementation provides it.

Browser directory handles remain browser-local and are never converted into
desktop paths. Server/runner locations are resolved only by their owning
authenticated target.

## Verification

Run the desktop gate from the workspace root:

    pnpm check:desktop
    pnpm check:terminal-surface-standard
    pnpm check:project-git-header-controls

For release validation, run:

    pnpm release:smoke:desktop
    pnpm release:smoke:desktop-packaged-launch
    pnpm release:smoke:desktop-startup

Desktop startup evidence must cover current-subject binding recovery, explicit
rebind, no-cwd fallback, and the selected runtime location's canonical local
root. It must not include a plaintext path in release evidence.

## Desktop Host Alignment

BirdCoder aligns to the SDKWork desktop host standard for build and release
architecture. The desktop host is a target-local resolver, not a replacement
for the distributed ProjectRuntimeLocation data model.
