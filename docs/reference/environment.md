# Environment

BirdCoder normalizes deployment profile, runtime target, environment, IAM
binding, and public API origin separately. Active templates are under
etc/topology. Source-controlled examples contain no credentials or
project-location paths.

## Runtime Selectors

| Variable | Scope | Allowed or purpose |
| --- | --- | --- |
| SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE | Server, desktop host | standalone or cloud. |
| SDKWORK_BIRDCODER_RUNTIME_TARGET | Server, desktop host | Explicit target such as desktop, server, or container. |
| SDKWORK_BIRDCODER_ENVIRONMENT | Server, desktop host | development, test, staging, or production. |
| VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE | Browser renderer | Public mirror of the selected deployment profile. |
| VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET | Browser renderer | Public mirror of the renderer target. |
| BIRDCODER_IAM_DEPLOYMENT_MODE | Development wrappers | desktop-local, server-private, or cloud-saas IAM binding selection. |
| SDKWORK_IAM_MODE | IAM runtime | local, private, or cloud. |

SDKWORK_DEPLOYMENT_MODE and VITE_SDKWORK_DEPLOYMENT_MODE are retired. Do not
introduce a third deployment profile to represent a project root, runtime
location, or execution capability.

## Server Configuration

| Variable | Purpose | Security boundary |
| --- | --- | --- |
| SDKWORK_BIRDCODER_SERVER_HOST / SDKWORK_BIRDCODER_SERVER_PORT | Native server bind address and port. | Cloud deployments cannot bind loopback-only. |
| SDKWORK_BIRDCODER_ALLOWED_ORIGINS | Comma-separated browser origins. | Required to be explicit and non-wildcard for cloud. |
| SDKWORK_BIRDCODER_DATABASE_ENGINE | sqlite or postgresql. | Cloud requires PostgreSQL. |
| SDKWORK_BIRDCODER_DATABASE_URL | Protected PostgreSQL connection string. | Inject through protected host configuration or a secret manager; never expose to Vite. |
| SDKWORK_BIRDCODER_DATABASE_FILE | Server/desktop SQLite file when approved. | Keep under the applicable SDKWork private/runtime data directory. |
| SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY | Master secret for encrypted runtime-location absolute paths. | Server/container only. Use base64url or raw material whose decoded/raw length is at least 32 bytes. Never expose it through `VITE_*`, client runtime config, source-controlled examples, logs, diagnostics, or command lines. |
| SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID | Stable identifier for the active runtime-location encryption key. | Server/container only. Must be a non-empty safe key id and must not enter public configuration, logs, or client bundles. |
| SDKWORK_BIRDCODER_RUNTIME_LOCATION_PREVIOUS_KEYS_JSON | JSON object mapping historical key ids to decryption-only key material. | Server/container only. Optional, limited to 15 entries, and must never contain the active key id. |
| SDKWORK_BIRDCODER_RUNTIME_LOCATION_FINGERPRINT_KEY | Stable secret used only for scoped duplicate-path fingerprints. | Required whenever historical keys are configured. Preserve it across encryption-key rotations. |
| SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT | Server-owned base for controlled workspace provisioning. | Not a client mount, public config value, or remote-execution switch. |
| SDKWORK_BIRDCODER_APP_ROOT | Read-only installed application asset root. | Never use as mutable project data. |

A server or container target accepts authenticated project and
runtime-location control-plane traffic. It never uses a request-supplied path
as its filesystem root. A target may decrypt a stored location path only after
it verifies its own target identity, project authorization, capability, health,
and canonical root.

## Runtime-Location Encryption Secrets

The active master key and key id are required only by the
server/container runtime that wires ProjectRuntimeLocation persistence. Supply
them from a protected secret manager, an ACL-restricted secret file, or an
equivalent server-only process environment. Do not add values for either
variable to `.env.example`, `sdkwork.app.config.json`, `VITE_*`, browser
runtime JSON, Docker image layers, Helm values, shell history, logs, traces, or
diagnostic output.

All key values accept base64url text or raw key material, but decoded or raw
material must be at least 32 bytes. Key ids must be non-empty and safe for
persistence. Missing or invalid material is a fail-closed configuration error:
the runtime-location service must not initialize, generate a fallback,
or downgrade to plaintext storage.

## Client API Configuration

BIRDCODER_API_BASE_URL and VITE_BIRDCODER_API_BASE_URL select a remote
BirdCoder server for private or cloud-backed Browser/Tauri clients. Packaged
remote clients require an explicit base URL so they do not silently fall back
to localhost.

VITE values are public build/runtime configuration. They must not contain
database URLs, access tokens, provider credentials, native paths, encrypted
path material, server workspace roots, or runtime-location secrets. Path
registration is an authenticated write-only app API operation, never an
environment variable.

The IAM app API configuration is server or host configuration. Cloud IAM fails
closed when required values are missing and does not create a local identity
fallback.

## Runtime Location And Local Bindings

No environment variable represents a user-selected project root.

- A runtime-location record persists target-specific root data in the
  BirdCoder control plane. Its absolute path is encrypted and its public
  responses are redacted.
- Browser stores a FileSystemDirectoryHandle in IndexedDB. It can recover only
  after permission succeeds; it never serializes to a native path.
- Tauri stores a native binding in host-private local storage, scoped to the
  active deployment realm and IAM subject. The binding is used only by the
  local native adapter and is not a server path reveal.
- BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT is a development/local-host
  convenience. It must not be returned by an API, recorded as production
  metadata, used to infer a remote target root, or treated as a project
  execution or native-session-discovery grant. Server execution requires an
  explicit, project-bound runtime-location resolution or synchronized runner
  source authority.

## Safe Production Baseline

    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
    SDKWORK_BIRDCODER_ENVIRONMENT=production
    SDKWORK_BIRDCODER_RUNTIME_TARGET=server
    SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
    SDKWORK_BIRDCODER_SERVER_PORT=10240
    SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
    SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
    SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=<server-private-project-workspace-root>

The database URL is injected through a protected secret source and is not
included in a source-controlled environment file. Cloud keeps the same explicit
server/container target, PostgreSQL, non-loopback bind, and exact origins. A
configured runner root does not enable a cloud runner. The runtime-location
master key and key id are deliberately omitted from this public baseline; a
secret-capable deployment wrapper provides them without printing their values.

## Inspection Commands

    pnpm check:env:desktop:local
    pnpm check:env:browser:standalone
    pnpm check:env:server:cloud
    pnpm check:iam:desktop:local
    pnpm check:iam:browser:standalone
    pnpm check:iam:server:cloud

Inspection commands mask secret-like values. Do not add paths, encrypted path
material, tokens, or database credentials to diagnostic output.
