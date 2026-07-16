# SDKWork BirdCoder

SDKWork BirdCoder is a multi-surface AI IDE workspace aligned with the SDKWork architecture standard at the host, release, CI, and deployment layers.

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

BirdCoder owns its AI IDE business modules (code, studio, terminal, skills, templates, settings) and follows the SDKWork architecture standard for host, release, CI, and deployment layers.

Project identity, persistent runtime locations, and local host capabilities
are explicit boundaries. A runtime location stores an encrypted target-specific
root and Git state for one project; a Browser folder handle remains local and
never becomes an OS path. A selected folder is never implicitly uploaded or
used by another execution target.
