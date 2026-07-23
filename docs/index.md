# SDKWork BirdCoder

SDKWork BirdCoder is the multi-surface SDKWork coding workbench. It composes platform capabilities through their canonical SDK families while retaining only BirdCoder-owned workspace and project facts.

## Start here

- [Getting Started](./guide/getting-started.md)
- [Technical Architecture](./architecture/tech/TECH_ARCHITECTURE.md)
- [Deployment Operations](./guides/operator/deployment-operations.md)
- [Windows Server Control Plane](./guides/operator/windows-server-control-plane.md)
- [Product Requirements](./product/prd/PRD.md)

## Delivery modes

- Web workspace host
- Desktop host (Tauri)
- Native server host (Rust)
- Docker deployment bundle
- Kubernetes deployment bundle

## Product boundary

BirdCoder owns coding-workbench workspace and project identity, project-to-document bindings, target-scoped runtime locations and preferences, and project-to-sandbox bindings. These facts are persisted only in the ten `studio_*` tables declared by the BirdCoder schema registry.

AI projects, sessions, turns, session items, interactions, runtime bindings, artifacts, and checkpoints belong to `sdkwork-agents`. Skills, packages, capabilities, installations, assets, and actions belong to `sdkwork-skills`. Human conversations and messages belong to `sdkwork-im`; AI assistant transcript items are Agents session items and are never IM messages. BirdCoder consumes each dependency through its canonical SDK family and stores only stable cross-domain identifiers where a workbench relationship requires them.

Project identity, persistent runtime locations, and local host capabilities
are explicit boundaries. A runtime location stores an encrypted target-specific
root and Git state for one project; a Browser folder handle remains local and
never becomes an OS path. A selected folder is never implicitly uploaded or
used by another execution target.
