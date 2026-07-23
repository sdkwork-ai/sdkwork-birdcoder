# SDKWork BirdCoder Container Deployment

This directory follows the SDKWork deployment standard: source-side templates copied into
packaged release bundles under `deploy/docker/`.

Base deployment:

```bash
docker compose -f deployments/docker/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deployments/docker/docker-compose.yml -f deployments/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deployments/docker/docker-compose.yml -f deployments/docker/docker-compose.amd-rocm.yml up -d
```

The container is a stateless BirdCoder gateway. It bundles the OpenAPI snapshot under
`/opt/sdkwork-birdcoder` and owns no database, migration, backup, or persistent data volume.
Set `SDKWORK_BIRDCODER_APP_ROOT` and `SDKWORK_OPENAPI_SNAPSHOT_PATH` only when overriding the
packaged application layout.
