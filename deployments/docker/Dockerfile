FROM ubuntu:24.04@sha256:2e863c44b718727c860746568e1d54afd13b2fa71b160f5cd9058fc436217b30 AS base

LABEL maintainer="SDKWork Cloud <cloud@sdkwork.dev>"
LABEL org.opencontainers.image.title="SDKWork BirdCoder"
LABEL org.opencontainers.image.description="SDKWork BirdCoder server container bundle"
LABEL org.opencontainers.image.vendor="SDKWork"
LABEL org.opencontainers.image.source="https://github.com/sdkwork-cloud/sdkwork-birdcoder"

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NO_UPDATE_NOTIFIER=true

RUN groupadd --system --gid 10001 birdcoder \
    && useradd --system --uid 10001 --gid birdcoder --no-create-home --shell /usr/sbin/nologin birdcoder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS runtime

WORKDIR /opt/sdkwork-birdcoder

ENV SDKWORK_BIRDCODER_APP_ROOT=/opt/sdkwork-birdcoder
ENV SDKWORK_OPENAPI_SNAPSHOT_PATH=/opt/sdkwork-birdcoder/openapi/birdcoder-app-api.openapi.json

# Build context is the unpacked container release bundle root. The packaging
# gate (scripts/release/package-release-assets.mjs) refuses to stage a Windows
# host-native binary into Linux release assets, so server/bin can only carry a
# Linux executable built by `pnpm build:server` on a Linux runner.
COPY --chown=birdcoder:birdcoder server/bin/sdkwork-birdcoder-standalone-gateway /opt/sdkwork-birdcoder/server/bin/sdkwork-birdcoder-standalone-gateway
COPY --chown=birdcoder:birdcoder openapi/birdcoder-app-api.openapi.json /opt/sdkwork-birdcoder/openapi/birdcoder-app-api.openapi.json
COPY --chown=birdcoder:birdcoder deploy/docker/profiles/default.env /opt/sdkwork-birdcoder/deploy/profiles/default.env

RUN chown -R birdcoder:birdcoder /opt/sdkwork-birdcoder && \
    chmod +x /opt/sdkwork-birdcoder/server/bin/sdkwork-birdcoder-standalone-gateway

USER birdcoder

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:18989/readyz || exit 1

EXPOSE 18989

CMD ["/opt/sdkwork-birdcoder/server/bin/sdkwork-birdcoder-standalone-gateway"]
