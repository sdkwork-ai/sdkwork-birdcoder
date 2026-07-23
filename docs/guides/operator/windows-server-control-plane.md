# Windows Server Control Plane

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: DEPLOYMENT_SPEC.md, SOURCE_CONFIG_SPEC.md, SECURITY_SPEC.md, OBSERVABILITY_SPEC.md

This guide deploys the stateless BirdCoder gateway on Windows Server. The
process owns the coding-workbench composition and System endpoints only. Agents,
Skills, IAM, IM, Kernel, and Providers retain their own domain authority.

## Preconditions

- Use a verified Windows x64 release containing
  `sdkwork-api-birdcoder-standalone-gateway.exe` and matching immutable assets.
- Run it under a dedicated non-administrator service account, never LocalSystem
  or an interactive developer identity.
- Put TLS termination, public DNS, and certificate management at an approved
  reverse proxy or load balancer. Configure exact browser origins.
- Keep the Tauri desktop application and its device-state file off the server.
- Do not provision a BirdCoder database, schema, migration runner, backup job,
  project directory, or runtime-location keyring.

## Directory And ACL Model

| Purpose | Recommended location | Required access |
| --- | --- | --- |
| Installed binary and immutable assets | `%ProgramFiles%\sdkwork\birdcoder` | Administrators write; service account reads and executes. |
| Operator configuration | `%ProgramData%\sdkwork\birdcoder\config` | Administrators and service account only. |
| Protected dependency credentials | `%ProgramData%\sdkwork\birdcoder\Secrets` | Service account and designated secret operators only. |
| Logs | `%ProgramData%\sdkwork\birdcoder\Logs` | Service account writes; operators read redacted output. |
| Ephemeral cache and temporary state | `%ProgramData%\sdkwork\birdcoder\Cache` | Service account only; safe to recreate. |

The gateway has no durable application data directory. Apply inheritance so
ordinary users, IIS identities, build agents, and RDP users cannot change
configuration, credentials, logs, or executable assets.

## Service Configuration

```text
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=server
SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
SDKWORK_BIRDCODER_SERVER_PORT=10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
```

The service wrapper must preserve configuration and credential ACLs and must
not print private values. Neither standalone nor cloud adds a BirdCoder-owned
execution runtime or persistence layer.

Test the release under the intended service account before registering it with
the service manager:

```powershell
& "$env:ProgramFiles\sdkwork\birdcoder\sdkwork-api-birdcoder-standalone-gateway.exe"
Invoke-WebRequest http://127.0.0.1:10240/healthz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:10240/readyz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:10240/openapi.json -UseBasicParsing
```

Stop the process before the service manager owns the port. Record the service
wrapper, account, configuration source, image/archive checksum, and rollback
reference in deployment evidence.

## Client And Local Capability Boundary

Browser and Tauri clients point to the gateway through public API base URL
configuration. URLs are endpoints, not credentials. The Windows service never
receives or uses:

- a browser directory handle;
- a plaintext local path as a terminal, Git, build, or execution argument;
- a PC project-device mount record;
- a Tauri device-state path;
- unvalidated target identity or capability claims.

Local directories, Git processes, worktrees, and terminals remain PC/Tauri
capabilities. The server uses canonical Agents project and Session contracts
without creating a second Project or runtime-location authority.

## Monitoring And Recovery

- Use `/healthz` for liveness, `/readyz` for dependency readiness, and
  `/metrics` through the approved monitoring path.
- Redact credentials and private identifiers from logs, traces, metric labels,
  and exported attributes.
- Restore the gateway by redeploying the prior immutable artifact and matching
  configuration. There is no BirdCoder database backup or migration replay.
- Coordinate domain-data recovery with the owning Agents, Skills, IAM, or IM
  service, not with this gateway.

## Verification

```powershell
pnpm test:topology-validate
node scripts/server-observability-contract.test.mjs
pnpm check:server
pnpm release:smoke:server
pnpm docs:build
```
