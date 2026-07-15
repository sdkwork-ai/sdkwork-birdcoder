# Windows Server Control Plane

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `DEPLOYMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`

This guide deploys the BirdCoder control plane on Windows Server. It is not an
instruction to turn the server into a shared remote IDE runtime. The current
remote `server` target must report code execution as unavailable until a
separately verified isolated runner is available.

## Preconditions

- Use a verified Windows x64 server release containing
  `sdkwork-birdcoder-standalone-gateway.exe` and its matching assets.
- Run it under a dedicated, non-administrator service account. Do not run the
  server as `LocalSystem` or as an interactive developer account.
- Use a supported database configuration. Production cloud configuration
  requires PostgreSQL and a protected `SDKWORK_BIRDCODER_DATABASE_URL`.
- Put TLS termination, public DNS, and certificate management at an approved
  reverse proxy or load balancer. Configure the exact public browser origins
  in `SDKWORK_BIRDCODER_ALLOWED_ORIGINS`.
- Keep the Tauri desktop application off the server. A desktop user mount is a
  device-local capability, not a server deployment input.

## Directory And ACL Model

Use the SDKWork Windows namespace from `RUNTIME_DIRECTORY_SPEC.md`:

| Purpose | Recommended location | Required access |
| --- | --- | --- |
| Installed binary and immutable assets | `%ProgramFiles%\sdkwork\birdcoder` | Administrators write; service account reads/executes. |
| Operator configuration | `%ProgramData%\sdkwork\birdcoder\config` | Administrators and the service account only. |
| Protected secrets | `%ProgramData%\sdkwork\birdcoder\Secrets` | Service account and designated secret operators only. |
| Database/other mutable server data | `%ProgramData%\sdkwork\birdcoder\Data` | Service account only, except approved backup restore. |
| Server-owned project workspace base | `%ProgramData%\sdkwork\birdcoder\Data\ProjectWorkspaces` | Service account only. |
| Logs | `%ProgramData%\sdkwork\birdcoder\Logs` | Service account writes; operators read. |
| Cache and temporary state | `%ProgramData%\sdkwork\birdcoder\Cache` | Service account only. |

Apply inheritance deliberately so ordinary users, IIS identities, build agents,
and RDP users cannot browse or change `Data`, `ProjectWorkspaces`, or `Secrets`.
The application derives child storage from trusted IAM/project context; an
operator must not map a client-provided path into this tree. Do not place a
browser handle, a Tauri local path, or a user's `%USERPROFILE%` project folder
under this server root.

## Service Configuration

The native server reads its configuration from process environment. Use the
organization's approved Windows service host or deployment wrapper only when
it can run as the dedicated account and inject non-secret configuration plus
secret references. `sc.exe` by itself does not load an environment file, so it
is not sufficient as a complete configuration mechanism.

Minimum production configuration is:

```dotenv
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=server
SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
SDKWORK_BIRDCODER_SERVER_PORT=10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
# Inject SDKWORK_BIRDCODER_DATABASE_URL from a protected secret source.
SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=%ProgramData%\sdkwork\birdcoder\Data\ProjectWorkspaces
```

For a `cloud` deployment, change only the deployment profile after confirming
all cloud validation requirements: `server` or `container` target, PostgreSQL,
a protected URL, non-loopback bind, and exact origins. Neither `standalone`
nor `cloud` turns `SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` into a remote
execution switch.

Test a release under the intended service account before registering it with a
service manager:

```powershell
& "$env:ProgramFiles\sdkwork\birdcoder\sdkwork-birdcoder-standalone-gateway.exe"
Invoke-WebRequest http://127.0.0.1:10240/healthz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:10240/readyz -UseBasicParsing
```

Run the process only long enough to perform the smoke. Stop it before the
service manager owns the port. The release package does not prove that a
Windows service has already been registered; record the service-wrapper choice,
account, configuration source, and recovery policy in deployment evidence.

## Client Connection And Isolation

Browser and Tauri clients point to the server through the public
`VITE_BIRDCODER_API_BASE_URL` / `BIRDCODER_API_BASE_URL` configuration. Those
values are public endpoints, not credentials. The server receives project ids
and authenticated SDK requests only. It must never receive:

- Browser `FileSystemDirectoryHandle` values;
- Tauri native mount paths;
- a client supplied project root or working directory;
- mount registry records or local filesystem telemetry.

Before enabling a user population, verify that two tenant/organization/user
contexts cannot read each other's project metadata or server-owned workspace
state. A Windows service account boundary supplements, but never replaces,
server-side authorization.

## Monitoring And Operations

- Use `/healthz` for liveness and `/readyz` for readiness.
- Use `/metrics` through the approved monitoring path and redact paths,
  credentials, and private identifiers from exported attributes.
- Keep the server port private behind TLS/reverse-proxy policy where possible;
  do not expose a development loopback configuration as production ingress.
- Back up the authoritative database and documented server-owned workspace
  data according to the retention policy. Do not back up browser/Tauri mount
  registries as server data.
- Treat any request to enable remote file, terminal, run, or deployment work as
  a product capability change requiring runner isolation and release evidence.

## Verification

```powershell
pnpm.cmd check:server
pnpm.cmd release:smoke:server
pnpm.cmd docs:build
```

See [deployment operations](deployment-operations.md) for Docker/Kubernetes
and cross-profile guidance, and [the environment reference](../../reference/environment.md)
for the authoritative configuration keys.
