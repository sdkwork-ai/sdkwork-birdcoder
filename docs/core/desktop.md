# Desktop Runtime

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, SECURITY_SPEC.md

BirdCoder desktop is a Tauri host plus the PC renderer. The renderer uses the
same owner SDK services as the browser. Tauri adds local capabilities through
typed commands and adapters.

## Device State

The Tauri device-state database contains one table, `device_state_entry`.
Command and SQL constraints permit only:

- application settings;
- subject-scoped project device mounts keyed by canonical Agents
  `projectId`;
- the desktop runtime-location installation identity.

The file is local capability state, not a BirdCoder business database, server
backup, or cross-device synchronization source. Values are bounded and must
not be copied into logs or release evidence.

## Local Project Flow

1. PC selects or creates an Agents Project.
2. The user authorizes a native directory for its canonical `projectId`.
3. Tauri validates and records the subject-scoped mount.
4. Filesystem, Git, worktree, and terminal adapters resolve that mount for each
   local action.
5. Missing, stale, mismatched, or denied mounts fail closed. No process-CWD or
   unrelated-project fallback is allowed.
6. When an Agents Session needs the device runtime identity, PC writes its
   opaque id through Agents `sessionRuntimeBindings`; the path stays local.

Browser directory handles remain browser capability objects and cannot become
Tauri paths or remote execution inputs.

## Verification

```bash
pnpm check:local-business-storage-boundary
pnpm test:project-device-mount-subject-isolation-contract
pnpm check:terminal-surface-standard
pnpm check:project-git-header-controls
pnpm check:desktop
```
