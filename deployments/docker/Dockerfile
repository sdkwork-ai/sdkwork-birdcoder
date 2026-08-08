# syntax=docker/dockerfile:1
# sdkwork-birdcoder standalone container image.
# runtimeTarget = "container", deploymentProfile = "standalone".
# Build context: an unpacked install-package container directory containing
# bin/, portal/, database-modules/, data/sdkwork-models/, sdkwork.app.config.json
# and container/ (entrypoint + metadata.json). Assemble the context with
# `pnpm build:container` (scripts/build-birdcoder-container.mjs); the committed
# copy is the build input and the package builder regenerates an equivalent
# container/Containerfile inside the install package.
#
# The gateway is a pure API host: the portal SPA is packaged at
# portal/dist and served by the deployment nginx reverse proxy
# (deployments/docker/docker/nginx), not by the gateway itself.

FROM debian:bookworm-slim

ARG GATEWAY_BINARY=sdkwork-birdcoder-standalone-gateway
ARG INSTALL_ROOT=/opt/sdkwork/birdcoder
ARG VERSION=0.1.0

# Runtime directory layout (RUNTIME_DIRECTORY_SPEC container scope):
# config mounts at /etc/sdkwork/birdcoder, secrets at /run/secrets/sdkwork/birdcoder,
# durable data at /var/lib/sdkwork/birdcoder, cache at /var/cache/sdkwork/birdcoder,
# logs at /var/log/sdkwork/birdcoder.
#
# Runtime packages (PACKAGING_SPEC: every installed tool must be justified):
#   libssl3 + ca-certificates — runtime dependencies of the gateway binary
#     (PostgreSQL TLS and outbound HTTPS); the slim base does not carry them.
#   curl — container healthcheck (/readyz probe) and operational diagnostics.
#   git — the coding-workbench agent runtime shells out to the git binary for
#     project repository operations (sdkwork-birdcoder-git subprocess runner).
RUN apt-get update \
  && apt-get install -y --no-install-recommends libssl3 ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system sdkwork \
  && useradd --system --gid sdkwork --home-dir ${INSTALL_ROOT} sdkwork \
  && mkdir -p ${INSTALL_ROOT} /etc/sdkwork/birdcoder /run/sdkwork/birdcoder \
    /var/lib/sdkwork/birdcoder /var/cache/sdkwork/birdcoder /var/log/sdkwork/birdcoder \
  && chown -R sdkwork:sdkwork /etc/sdkwork/birdcoder /run/sdkwork/birdcoder \
    /var/lib/sdkwork/birdcoder /var/cache/sdkwork/birdcoder /var/log/sdkwork/birdcoder

WORKDIR ${INSTALL_ROOT}
COPY . ${INSTALL_ROOT}
RUN chmod 0755 ${INSTALL_ROOT}/bin/${GATEWAY_BINARY} \
    ${INSTALL_ROOT}/container/entrypoint

ENV SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
ENV SDKWORK_BIRDCODER_RUNTIME_TARGET=container
# Application identity root: sdkwork.app.config.json is installed at the
# install root; IAM tenant provisioning resolves it via SDKWORK_APP_ROOT.
ENV SDKWORK_APP_ROOT=${INSTALL_ROOT}
ENV SDKWORK_BIRDCODER_APP_ROOT=${INSTALL_ROOT}
# Models catalog (sdkwork-models.json + models/ + overlays/) installed under
# <install root>/data/sdkwork-models; the bundled catalog fallback of the
# models assembly (SDKWORK_MODELS_CATALOG_ROOT).
ENV SDKWORK_MODELS_CATALOG_ROOT=${INSTALL_ROOT}/data/sdkwork-models
# Database module roots: compile-time app roots do not exist inside the image,
# so each database host resolves its packaged module under
# <install root>/database-modules/<workspace>/database instead. These defaults
# can be overridden with mounted module trees.
ENV SDKWORK_MODELS_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-models \
    SDKWORK_IAM_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-iam \
    SDKWORK_AGENTS_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-agents \
    SDKWORK_DOCUMENTS_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-documents \
    SDKWORK_DRIVE_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-drive \
    SDKWORK_MEMBERSHIP_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-membership \
    SDKWORK_ORDER_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-order \
    SDKWORK_PROMPTS_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-prompts \
    SDKWORK_SKILLS_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-skills \
    SDKWORK_DEPLOY_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-deployments \
    SDKWORK_APPBASE_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-appbase \
    SDKWORK_BASE_DATA_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-appbase \
    SDKWORK_EDU_DATA_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-appbase \
    SDKWORK_MED_DATA_APP_ROOT=${INSTALL_ROOT}/database-modules/sdkwork-appbase

LABEL org.opencontainers.image.title="sdkwork-birdcoder (standalone container)"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.vendor="sdkwork"

USER sdkwork

# Gateway readiness probe: compose can restart/replace the gateway when it
# stops answering, and operators can schedule dependents on it. curl is
# installed above for this probe and operational diagnostics.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
    CMD curl -fsS http://127.0.0.1:10240/readyz >/dev/null 2>&1 || exit 1

EXPOSE 10240
ENTRYPOINT ["/opt/sdkwork/birdcoder/container/entrypoint"]
