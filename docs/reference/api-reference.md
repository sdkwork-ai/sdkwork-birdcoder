# API Overview

BirdCoder architecture standardizes internal delivery APIs even when the product surface stays AI IDE-specific.

## Canonical surfaces

- host/runtime boundaries in `sdkwork-birdcoder-host-core`
- release-profile and family metadata in `scripts/release/release-profiles.mjs`
- release manifests and notes rendering in `scripts/release/*`
- deployment inputs in `deploy/docker` and `deploy/kubernetes`

## Principle

The API standard is unified at the architecture layer: one release profile, one manifest model, one family taxonomy, and one reusable GitHub workflow shape.
