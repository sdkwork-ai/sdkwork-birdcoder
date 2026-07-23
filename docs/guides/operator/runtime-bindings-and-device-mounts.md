# Agents Runtime Bindings And PC Device Mounts

Status: active  
Owner: SDKWork maintainers  
Updated: 2026-07-23  
Specs: APP_PC_ARCHITECTURE_SPEC.md, SECURITY_SPEC.md, OBSERVABILITY_SPEC.md

## Ownership

| Fact | Owner |
| --- | --- |
| Project and composition | `sdkwork-agents` |
| Session, Turn, Session Item, Interaction | `sdkwork-agents` |
| Session-to-runtime binding with opaque location id | `sdkwork-agents` |
| Current-device project directory mount | PC `ProjectDeviceMountRegistry` |
| Native path, Git process, worktree, terminal | PC/Tauri host |

The registry uses the canonical Agents `projectId`. There is no workbench
Workspace id, second Project id, mapping record, or server mount API.

## Session Flow

1. Select or create the Agents Project through its generated SDK.
2. Resolve the current subject's authorized local mount for its `projectId`.
3. Create the Agents Session with the same `projectId`.
4. Create or resolve the Agents `sessionRuntimeBindings` entry using the
   opaque id from the local host identity.
5. Keep the native path and execution handles inside Tauri.

Missing mount, denied permission, subject mismatch, invalid root, or missing
opaque id fails closed. Do not use process CWD or another Project's mount.

## Recovery

Device state is not server backup data. On another or repaired device, the user
reselects the directory and creates a new subject-scoped mount for the same
canonical `projectId`. Existing Agents Project and Session facts remain in
their owner service; local execution stays unavailable until rebinding succeeds.

## Verification

```bash
pnpm check:local-business-storage-boundary
pnpm test:project-device-mount-subject-isolation-contract
pnpm check:terminal-surface-standard
pnpm check:desktop
```
