# SDKWork BirdCoder Container Deployment

This directory follows the SDKWork deployment standard: source-side templates copied into
packaged release bundles under `deploy/docker/`.

## Packaging The Container Bundle

The container image is built from the **unpacked container release bundle**, never from
host-native build outputs. The packager (`pnpm package` with the `container` family) refuses
to stage a Windows host-native binary into Linux release assets, so the bundle's
`server/bin/sdkwork-birdcoder-standalone-gateway` is always a Linux executable produced by
`pnpm build:server` on a Linux runner (or a cross-compilation target).

```bash
# On a Linux build host: build the server, web app, docs, then package the bundle.
pnpm build:server
pnpm build
pnpm docs:build
pnpm package:container
```

## Building And Running The Image

Unpack the packaged container bundle, then compose from the repository:

```bash
tar -xzf artifacts/release/container/linux/x64/cpu/sdkwork-birdcoder-container-release-local-linux-x64.tar.gz -C artifacts/release/container/linux/x64/cpu/
docker compose -f deployments/docker/docker-compose.yml up -d
```

The bundle-embedded compose (`deploy/docker/docker-compose.yml` inside the unpacked bundle)
is the canonical launcher for a deployed bundle; the packager rewrites its Dockerfile
reference to the bundle-relative `deploy/docker/Dockerfile` path.

NVIDIA CUDA overlay:

```bash
docker compose -f deployments/docker/docker-compose.yml -f deployments/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deployments/docker/docker-compose.yml -f deployments/docker/docker-compose.amd-rocm.yml up -d
```

## Runtime Contract

The container is a stateless BirdCoder gateway. It bundles the OpenAPI snapshot under
`/opt/sdkwork-birdcoder` and owns no database, migration, backup, or persistent data volume.
Set `SDKWORK_BIRDCODER_APP_ROOT` and `SDKWORK_OPENAPI_SNAPSHOT_PATH` only when overriding the
packaged application layout.
