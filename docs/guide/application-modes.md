# Application Modes

BirdCoder keeps one renderer and project-service model while separating
delivery topology, IAM deployment binding, runtime-location authority, and
host-specific filesystem capability.

## Delivery Modes

- web: browser-hosted workspace
- desktop: packaged Tauri host
- server: native host that serves built web assets
- container: Docker-oriented deployment bundle
- kubernetes: Helm-compatible deployment bundle

## IAM Deployment Modes

| Deployment mode | Standard command family | Standard runtime shape |
| --- | --- | --- |
| desktop-local | pnpm dev:desktop:local and pnpm dev:desktop | Desktop host embeds the coding server and uses local SDKWork IAM storage. |
| server-private | pnpm dev and pnpm dev:server:postgres:standalone | Web or desktop clients connect to a private BirdCoder server exposing the canonical SDKWork IAM facade. |
| cloud-saas | pnpm dev:browser:postgres:cloud and pnpm dev:server:cloud | BirdCoder server keeps the same app facade while using the cloud SDKWork IAM authority. |

## Standard Routes

Each delivery mode shares the same release profile, checksum finalization,
release notes flow, and machine-readable manifest contract. Each IAM
deployment mode keeps the same frontend-facing app API routes:

- /app/v3/api/auth/*
- /app/v3/api/iam/users/current
- /app/v3/api/memberships/current
- /app/v3/api/memberships/package_groups

Deployment topology may change, but the BirdCoder UI and service layer remain
branch-free and consume SDKWork IAM through the generated app SDK surface.

## Project, Runtime Location, And Folder Modes

The remote Project remains shared identity and authorization metadata.
ProjectRuntimeLocation stores one target-specific root, health, capability, and
Git snapshot for that Project. A location is not a global single path and does
not grant execution without owning-target validation.

- Browser stores a FileSystemDirectoryHandle using IndexedDB structured
  cloning. Permission recovery requires an explicit rebind. The handle is not
  a native path and is not an executable remote location.
- Tauri keeps a native binding in host-private local storage, scoped to the
  active IAM subject and project. Desktop import registers a write-only,
  encrypted runtime location and retains the local binding needed to start a
  local terminal.
- Server, container, runner, and remote-workspace target enrollment is not yet
  enabled. Until a mutually authenticated target resolver verifies a location,
  those actions return typed unavailable results rather than deriving or
  executing against a configured root.
- A current-subject capability preference may assist interactive selection for
  terminal, Git (including worktree), build, or file-system work, but the
  action resolves and carries an exact runtimeLocationId before execution.
  Worktree uses the Git capability rather than a separate preference. Coding
  Session execution uses the runtimeLocationId persisted when the session was
  created. No action infers a process CWD or project-only root.

BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT remains a local development bootstrap
option only. It does not become a project record, runtime-location response,
or server execution grant.
