# Application Modes

BirdCoder keeps one product surface but supports multiple delivery modes through a unified host and release architecture.

## Modes

- `web`: browser-hosted workspace
- `desktop`: packaged Tauri host
- `server`: native host that serves the built web assets
- `container`: Docker-oriented deployment bundle
- `kubernetes`: Helm-compatible deployment bundle

## Standard

Each mode shares the same release profile, checksum finalization, release notes flow, and machine-readable manifest contract.
