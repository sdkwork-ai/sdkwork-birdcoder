# SDKWork BirdCoder standalone Docker deployment

Container packaging + WSL Ubuntu quick deployment for the SDKWork BirdCoder
coding workbench, modeled on the sdkwork-cloudrouter docker pipeline and
following `sdkwork-specs` `PACKAGING_SPEC.md` / `DEPLOYMENT_SPEC.md` /
`NGINX_SPEC.md` / `PNPM_SCRIPT_SPEC.md`.

## Topology

```
Windows browser
   │  hosts: 127.0.0.1 testapidocker.sdkwork.com testapidocker.birdcoder.com testapidocker.dtupay.com
   │  (WSL2 localhost forwarding)
   ▼
WSL Ubuntu nginx :80  (deployments/docker/docker/nginx/testapidocker-birdcoder.conf)
   │  ├── SPA static  /opt/sdkwork/birdcoder/portal  (extracted from the image)
   │  └── API prefixes /app /backend /api /readyz /healthz /livez /metrics /openapi.json
   ▼
docker compose (deployments/docker/docker-compose.yml)
   ├── birdcoder  (image birdcoder:local, host 10243 -> container 10240)
   └── postgres:16-alpine  (schema init + healthcheck, no host ports)
```

The gateway container is a pure API host; the portal SPA is packaged at
`portal/dist` inside the image and served by nginx.

## Prerequisites

- WSL2 Ubuntu (tested on Ubuntu-22.04) with Docker Engine and nginx installed
  and running
- The Linux gateway release binary, built on the Linux host (a Windows cargo
  build cannot run in the container):

  ```bash
  cd <workspace>   # in WSL
  CARGO_TARGET_DIR=~/sdkwork-target/birdcoder-release \
    cargo build --release -p sdkwork-api-birdcoder-standalone-gateway
  strip ~/sdkwork-target/birdcoder-release/release/sdkwork-api-birdcoder-standalone-gateway
  ```

- Portal dist (production SPA with the docker test origin):

  ```bash
  # on Windows
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL=http://testapidocker.sdkwork.com \
  SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL=http://testapidocker.sdkwork.com \
    pnpm build:prod
  ```

## Build the container image

```bash
pnpm build:container:check      # validate the declarative package plan
pnpm build:container            # stage -> install package -> docker build birdcoder:local
```

Outputs (all git-ignored):

- `dist/install-packages/sdkwork-birdcoder-linux-x64-container-<version>.tar.gz`
- `dist/container-image-build/` — unpacked build context (declared entries only)
- `dist/container-image.json` — image manifest: id, size, layer sizes, package sha256
- `dist/install-package-staging/` — staging root

Content compliance (PACKAGING_SPEC §6):

```bash
pnpm install:package:check:content
```

## Deploy on WSL Ubuntu

One command (run on Windows; uses `wsl -u root` for nginx, no password
needed):

```bash
pnpm deploy:apply:standalone
```

This performs:

1. creates `deployments/docker/.env` from `docker/.env.example` when missing
2. builds the image (or reuses it with `--skip-build`)
3. `docker compose up -d` (postgres + birdcoder)
4. waits for the gateway `/readyz` probe
5. extracts the portal SPA from the image to `/opt/sdkwork/birdcoder/portal`
6. disables the stale `testapidocker-im.conf` (renamed `.orig`) and installs
   `testapidocker-birdcoder.conf`, then `nginx -t` + reload

Bind the Windows hosts file (admin; UAC prompt):

```bash
pnpm hosts:bind
```

Then verify:

```bash
pnpm deploy:validate:standalone
```

Access the app from the Windows browser:

- http://testapidocker.sdkwork.com
- http://testapidocker.birdcoder.com
- http://testapidocker.dtupay.com

Other commands:

```bash
pnpm deploy:plan:standalone       # print the deployment plan
pnpm deploy:rollback:standalone   # compose down + restore previous nginx config
pnpm nginx:plan | render | deploy # render/deploy the nginx config standalone
pnpm hosts:check                  # inspect current hosts binding state
```

## Configuration

All runtime values default to local-development values; override via
`deployments/docker/.env` (see `docker/.env.example`):

| Key | Default | Purpose |
| --- | --- | --- |
| `BIRDCODER_ENVIRONMENT` | `test` | gateway deployment environment |
| `BIRDCODER_APPLICATION_PUBLIC_HTTP_URL` | `http://testapidocker.sdkwork.com` | advertised application origin |
| `SDKWORK_CORS_ALLOWED_ORIGINS` | 3 test domains + localhost:10243 | canonical CORS allow-list |
| `BIRDCODER_POSTGRES_DB/USER/PASSWORD` | `sdkwork_ai_test` | PostgreSQL identity (schema init SQL must match) |
| `BIRDCODER_IAM_SUPER_ADMIN_PASSWORD` | empty | IAM super-admin bootstrap password |
| `BIRDCODER_CPU_LIMIT/MEMORY_LIMIT` | 4.0 / 4g | container resource guardrails |

The image bakes `SDKWORK_*_APP_ROOT` defaults pointing at
`/opt/sdkwork/birdcoder/database-modules/<repo>` for the federated database
modules (iam, agents, models, documents, drive, membership, order, prompts,
skills, deployments, appbase) and `SDKWORK_MODELS_CATALOG_ROOT` for the
bundled models catalog.

## Package layout (container install package)

```
bin/sdkwork-birdcoder-standalone-gateway   gateway executable (stripped Linux ELF)
portal/dist/                               portal SPA dist (served by nginx)
database-modules/<repo>/database/          federated database modules
data/sdkwork-models/                       bundled models catalog
sdkwork.app.config.json                    application identity manifest
container/entrypoint                       container entrypoint
container/Containerfile                    equivalent container file
container/metadata.json                    container metadata
install-manifest.json                      per-file content manifest (path, size, sha256)
INSTALL.md                                 install guide
```

## Ports

| Port | Holder |
| --- | --- |
| 10240 | gateway container ingress (container-internal) |
| 10243 | host-side gateway mapping (nginx upstream) |
| 5432 | PostgreSQL (compose network only) |
| 80 | WSL nginx (test domains) |
