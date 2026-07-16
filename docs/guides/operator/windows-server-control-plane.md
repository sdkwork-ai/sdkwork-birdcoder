# Windows Server Control Plane

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: DEPLOYMENT_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, OBSERVABILITY_SPEC.md

This guide deploys the BirdCoder control plane on Windows Server. It is not an
instruction to turn the server into a shared remote IDE runtime. A
ProjectRuntimeLocation can be persisted for a server target, but it cannot
enable remote code execution until an isolated runner is separately verified.

## Preconditions

- Use a verified Windows x64 release containing
  sdkwork-birdcoder-standalone-gateway.exe and matching assets.
- Run it under a dedicated, non-administrator service account. Do not run the
  service as LocalSystem or as an interactive developer account.
- Use a supported database configuration. Production cloud configuration
  requires PostgreSQL and protected database credentials.
- Inject both runtime-location encryption settings through an approved secret
  source: `SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY` must be base64url or
  raw material with at least 32 decoded/raw bytes, and
  `SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID` must be a non-empty safe key id.
  The service must fail closed when either value is missing or invalid; neither
  value may appear in a tracked environment file, `VITE_*` or client runtime
  config, command line, log, or diagnostic.
- Put TLS termination, public DNS, and certificate management at an approved
  reverse proxy or load balancer. Configure exact browser origins.
- Keep the Tauri desktop application off the server. A desktop local binding
  proves only the current desktop capability, not server access.

## Directory And ACL Model

Use the SDKWork Windows namespace:

| Purpose | Recommended location | Required access |
| --- | --- | --- |
| Installed binary and immutable assets | %ProgramFiles%\sdkwork\birdcoder | Administrators write; service account reads/executes. |
| Operator configuration | %ProgramData%\sdkwork\birdcoder\config | Administrators and service account only. |
| Protected secrets and key references | %ProgramData%\sdkwork\birdcoder\Secrets | Service account and designated secret operators only. |
| Database and mutable server data | %ProgramData%\sdkwork\birdcoder\Data | Service account only, except approved backup restore. |
| Server-owned project workspace base | %ProgramData%\sdkwork\birdcoder\Data\ProjectWorkspaces | Service account only. |
| Logs | %ProgramData%\sdkwork\birdcoder\Logs | Service account writes; operators read redacted output. |
| Cache and temporary state | %ProgramData%\sdkwork\birdcoder\Cache | Service account only. |

Apply inheritance deliberately so ordinary users, IIS identities, build agents,
and RDP users cannot browse or change Data, ProjectWorkspaces, Secrets, or
cache state. The application never maps a raw user-supplied path into this
tree. A server target resolves only its own registered location through the
authenticated internal resolver.

## Service Configuration

The native server reads configuration from process environment or an approved
secret-capable service wrapper:

    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
    SDKWORK_BIRDCODER_ENVIRONMENT=production
    SDKWORK_BIRDCODER_RUNTIME_TARGET=server
    SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
    SDKWORK_BIRDCODER_SERVER_PORT=10240
    SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
    SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
    SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=%ProgramData%\sdkwork\birdcoder\Data\ProjectWorkspaces

Inject the database URL, runtime-location master key, and key id through a
protected secret source. The service wrapper must preserve file/secret ACLs,
must not print the effective values, and must not synthesize a missing key.
Neither standalone nor cloud turns a workspace base or persisted location into
a remote execution switch.

Test a release under the intended service account before registering it with a
service manager:

    & "$env:ProgramFiles\sdkwork\birdcoder\sdkwork-birdcoder-standalone-gateway.exe"
    Invoke-WebRequest http://127.0.0.1:10240/healthz -UseBasicParsing
    Invoke-WebRequest http://127.0.0.1:10240/readyz -UseBasicParsing

Stop the process before the service manager owns the port. Record the service
wrapper choice, account, secret source, configuration source, and recovery
policy in deployment evidence without including secret or plaintext path
values.

## Client Connection And Isolation

Browser and Tauri clients point to the server through public API base URL
configuration. Those URLs are endpoints, not credentials. The server may
receive a typed, authenticated, write-only location-registration request from a
trusted desktop import, but it never returns that path and never treats it as
a server filesystem root.

The server must never receive or use:

- Browser FileSystemDirectoryHandle values;
- a plaintext path as a remote terminal/Git/build execution argument;
- mount registry records or local filesystem telemetry as target authority;
- unvalidated target identity or capability claims.

Before enabling users, verify that tenant, organization, user, project, target,
and location boundaries deny cross-scope access. A Windows service account
boundary supplements, but never replaces, server-side authorization.

## Monitoring And Operations

- Use health for liveness, readiness for migration/key/dependency readiness,
  and metrics through the approved monitoring path.
- Redact paths, key material, credentials, and private identifiers from logs,
  traces, metric labels, and exported attributes.
- Back up the authoritative database and documented server-owned workspace
  data according to the retention policy. Preserve protected key-management
  references separately. Do not back up Browser/Tauri local bindings as server
  data.
- Treat requests to enable remote file, terminal, run, build, or deployment as
  product capability changes requiring target/runner isolation and release
  evidence.

## Verification

    pnpm db:validate
    pnpm check:server
    pnpm release:smoke:server
    pnpm docs:build
