# Environment

BirdCoder normalizes deployment profile, runtime target, environment, IAM
binding, and public API origin separately. The active templates are under
`configs/topology/`; source-controlled examples contain no real credentials.
Global behavior is governed by `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, and
`RUNTIME_DIRECTORY_SPEC.md`.

## Runtime Selectors

| Variable | Scope | Allowed / purpose |
| --- | --- | --- |
| `SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` | Server, desktop host | `standalone` or `cloud`. |
| `SDKWORK_BIRDCODER_RUNTIME_TARGET` | Server, desktop host | Explicit target such as `desktop`, `server`, or `container`. |
| `SDKWORK_BIRDCODER_ENVIRONMENT` | Server, desktop host | `development`, `test`, `staging`, or `production`. |
| `VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` | Browser renderer | Public mirror of the selected deployment profile. |
| `VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET` | Browser renderer | Public mirror of the renderer target. |
| `BIRDCODER_IAM_DEPLOYMENT_MODE` | Development wrappers | `desktop-local`, `server-private`, or `cloud-saas` IAM binding selection. |
| `SDKWORK_IAM_MODE` | IAM runtime | `local`, `private`, or `cloud`. |

`SDKWORK_DEPLOYMENT_MODE` and `VITE_SDKWORK_DEPLOYMENT_MODE` are retired and
the native server rejects them. Do not introduce a third deployment profile to
represent a local folder, a server workspace, or an execution location.

## Server Configuration

| Variable | Purpose | Security boundary |
| --- | --- | --- |
| `SDKWORK_BIRDCODER_SERVER_HOST` / `SDKWORK_BIRDCODER_SERVER_PORT` | Native server bind address and port. The native default is loopback `127.0.0.1:10240`; deployment bundles may set their own port. | Cloud deployments cannot bind loopback-only. |
| `SDKWORK_BIRDCODER_ALLOWED_ORIGINS` | Comma-separated browser origins. | Required to be explicit and non-wildcard for cloud. |
| `SDKWORK_BIRDCODER_DATABASE_ENGINE` | `sqlite` or `postgresql`. | Cloud requires PostgreSQL. |
| `SDKWORK_BIRDCODER_DATABASE_URL` | Protected PostgreSQL connection string. | Inject from a secret-bearing host configuration or secret manager; never expose to Vite. |
| `SDKWORK_BIRDCODER_DATABASE_FILE` | Server/desktop SQLite file when SQLite is an approved profile. | Keep it under the applicable SDKWork private/runtime data directory. |
| `SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` | Server-owned project workspace base. | Not a Browser/Tauri mount, not a client API field, and not an execution-enable flag. |
| `SDKWORK_BIRDCODER_APP_ROOT` | Read-only installed application asset root. | Never use it as mutable user/project data. |

A `server` or `container` target accepts remote project control-plane traffic;
it must not use a client-provided path as its filesystem root. In the current
implementation, remote code execution remains unavailable even when
`SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` is configured. The variable reserves
server-owned storage for authorized project source and Git workflows only.

## Client API Configuration

`BIRDCODER_API_BASE_URL` and `VITE_BIRDCODER_API_BASE_URL` select a remote
BirdCoder server for private or cloud-backed Browser/Tauri clients. Packaged
remote clients require an explicit base URL so they do not silently fall back
to localhost. `VITE_*` values are public build/runtime configuration and must
not contain database URLs, access tokens, provider credentials, native paths,
or server workspace roots.

The IAM app API configuration (`SDKWORK_IAM_APP_API_BASE_URL`,
`SDKWORK_IAM_APP_API_TIMEOUT_MS`, `SDKWORK_IAM_APP_ID`,
`SDKWORK_IAM_SECRET_ID`, and `SDKWORK_IAM_SHARED_SECRET`) is server or host
configuration. Cloud IAM fails closed when required values are missing; it
does not create a local identity fallback.

## Device-Private Folder Mounts

No environment variable represents a user-selected project folder.

- Browser stores a `FileSystemDirectoryHandle` in IndexedDB with structured
  cloning. On recovery it queries permission and requires explicit rebind when
  permission is not granted.
- Tauri stores a native path only in its host-private `local_store_*` SQLite KV
  namespace. It is scoped to the active deployment realm and IAM
  tenant/organization/user/project. It is plaintext at rest.
- `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` is a development/local-host bootstrap
  convenience only. It must not be set as a remote server project root and must
  never be returned by a remote project API.

## Safe Production Baseline

```dotenv
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=server
SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
SDKWORK_BIRDCODER_SERVER_PORT=10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
# Inject SDKWORK_BIRDCODER_DATABASE_URL through a protected secret source.
SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=<server-private-project-workspace-root>
```

For `cloud`, retain the same explicit `server` or `container` target, use
PostgreSQL, a non-loopback bind, and exact origins. The profile validates those
requirements at startup but still does not enable a cloud runner.

## Inspection Commands

```bash
pnpm.cmd iam:show:desktop:local
pnpm.cmd iam:show:web:private
pnpm.cmd iam:show:server:cloud
pnpm.cmd iam:doctor:desktop:local
pnpm.cmd iam:doctor:web:private
pnpm.cmd iam:doctor:server:cloud
```

Use local overrides only for development or explicit deployment validation.
The inspection commands mask secret-like values; do not add paths, tokens, or
database credentials to diagnostic output.
