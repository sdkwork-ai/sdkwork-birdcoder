# SDKWork BirdCoder Container Deployment

This directory follows the same packaging role as `apps/claw-studio/deploy/docker`: source-side
deployment templates that are copied into packaged release bundles.

Base deployment:

```bash
docker compose -f deploy/docker/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.amd-rocm.yml up -d
```
