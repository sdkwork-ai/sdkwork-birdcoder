# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: `sdkwork-birdcoder`
Updated: 2026-07-14
Specs: `REQUIREMENTS_SPEC.md`, `DOCUMENTATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`

## 1. Product And Problem

BirdCoder is a coding workbench that gives the same project experience to a
browser and a Windows Tauri desktop application without confusing remote
project identity with a local folder. A developer may use the product against
a server-hosted project catalog while choosing a folder only on the current
device. That folder capability must never appear in remote metadata or in
another user's environment.

The product therefore distinguishes a remote Project from a device-private
Project Mount. A project is shared, authorized metadata with an opaque id. A
mount is the current user's explicit local folder selection. A server workspace
root, when needed, is an internal server resource derived from authenticated
scope rather than a path submitted by a client.

## 2. Target Users And Outcomes

| User | Surface | Outcome |
| --- | --- | --- |
| Individual developer | Browser | Work with remote project metadata and explicitly select or rebind a browser-local folder when local file access is required. |
| Individual developer | Windows Tauri IDE | Use the same renderer and remote project API while the selected native folder stays private to the Windows account. |
| Team member | Private or cloud server | Access only projects and workspaces allowed by tenant, organization, membership, and project ACLs. |
| Operator | Windows Server, container, or Kubernetes | Run the authenticated BirdCoder control plane with private server storage, explicit origins, and no reliance on a user's local filesystem. |

## 3. Goals And Non-Goals

Goals:

- Use one renderer, feature-service layer, and composed app SDK for Browser and
  Tauri.
- Keep remote project APIs path-free and make local folder access an explicit
  device capability.
- Persist browser folder handles only with IndexedDB structured cloning and
  persist Tauri paths only in host-private local storage.
- Scope mount recovery to the active IAM tenant, organization, user, deployment
  realm, and project; clear local runtime state when that scope changes.
- Support Windows local IDE delivery and remotely deployed BirdCoder server
  control-plane delivery using the same project contract.
- Ensure remote server filesystem and future runtime bindings are independently
  derived per authorized user/workspace/project, never from browser or desktop
  paths.

Non-goals for the current pre-launch capability set:

- Uploading, synchronizing, or exposing a local folder merely because it was
  selected in Browser or Tauri.
- Treating a browser `FileSystemDirectoryHandle` or a Tauri path as a remote
  project field, server workspace root, SDK DTO, log value, or telemetry value.
- Running arbitrary code on a production remote server or cloud deployment
  before an isolated runner has been implemented and verified.
- Claiming encrypted Tauri mount storage. The current host-private SQLite KV
  record is plaintext.

## 4. In-Scope User Scenarios

1. A user creates or selects a remote project. The server returns metadata and
   an opaque project id, not a local or server path.
2. The user imports a local folder. BirdCoder creates or selects the remote
   project, then binds that project id to the selected folder only on the
   current device.
3. On Browser, a saved `FileSystemDirectoryHandle` can be recovered only when
   `queryPermission` grants read/write access. Otherwise the user explicitly
   reauthorizes or reselects the folder.
4. On Tauri, the host resolves a native folder through its private local store
   and native filesystem adapter. The UI receives only a safe display name and
   mount status.
5. The user changes account, tenant, or organization. BirdCoder drops in-memory
   file watchers, caches, and mounts before processing the new scope.
6. A browser or Tauri client connects to a remote server. Project and workspace
   authorization remains server-enforced, while local file operations continue
   to use only that client's mount.
7. A remote execution, server filesystem, terminal, or deployment action is
   requested before a qualified isolated runner exists. The product returns a
   typed unavailable result rather than using a server cwd, default directory,
   or client-local fallback.

## 5. Functional Requirements

1. Remote Project APIs contain identity, descriptive metadata, workspace
   association, lifecycle, and authorization-relevant identifiers only; they do
   not contain client paths, browser handles, or server roots.
2. Local folder import creates the remote project independently from device
   mounting and does not transmit the selected local source in create or update
   requests.
3. Browser and Tauri expose an equivalent mount state model: mounted,
   recoverable, permission-required, mount-required, or session-required.
4. Browser restoration is non-interactive. It queries current permission and
   requires an explicit user action for reauthorization or rebinding.
5. Tauri mount persistence is OS-account-private and subject-scoped, but its
   plaintext-at-rest limitation is documented to operators and users.
6. The remote server derives every server-owned workspace root from trusted
   tenant, organization, user/membership, workspace, project, and worktree
   context. It does not use request paths or a process default directory.
7. Server-side authorization is checked before project metadata, workspace
   storage, or a future runtime binding is read or changed.

## 6. Quality, Security, And Commercial Gates

| Gate | Required evidence |
| --- | --- |
| Cross-host parity | Browser and Tauri use the same project service and app SDK contract; only their local mount adapters differ. |
| Boundary safety | Static and contract checks reject path-bearing remote project fields and prevent mount sources from crossing SDK/API/logging boundaries. |
| Scope isolation | Account, tenant, and organization switch tests clear in-memory mount state; server tests deny cross-scope project and workspace access. |
| Browser recovery | Tests cover saved handle, denied permission, unsupported File System Access API, cancellation, and explicit rebind. |
| Tauri recovery | Tests cover host-private local-store persistence, missing record, invalid path, and subject change without exposing a path to UI or network. |
| Remote runtime | No production remote execution is advertised until a runner isolation, durable scheduling, recovery, and resource-governance review passes. |
| Release | Browser, desktop, server, API/SDK, and documentation gates pass for the actual deployment profile and runtime target. |

## 7. Delivery Phases

1. Unified project and device-mount boundary: path-free remote contracts,
   Browser/Tauri mount registry, scope-aware recovery, and documentation.
2. Server storage hardening: server-derived workspace roots, object-level
   authorization, tenant isolation tests, Windows Server operator evidence,
   and deployment profile parity.
3. Qualified remote runtime: durable scheduling, isolated runner lifecycle,
   private runtime assets, resource limits, secret brokering, recovery, and
   operational evidence. This phase is not complete today.
4. Commercial promotion: signed packages, rollback evidence, production
   monitoring, capacity validation, and a successful release gate for each
   enabled capability.

## 8. Traceability

- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [ADR-20260713: Unified project/runtime boundary](../../architecture/decisions/ADR-20260713-unified-project-runtime-boundary.md)
- [Deployment operations](../../guides/operator/deployment-operations.md)
- [Windows Server control plane](../../guides/operator/windows-server-control-plane.md)

Global API, security, SDK, deployment, and test rules remain authoritative in
the corresponding `sdkwork-specs` documents. This PRD records product outcomes
and does not replace those contracts.
