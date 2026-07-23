# BirdCoder Changelog

Status: active
Owner: SDKWork maintainers
Specs: DOCUMENTATION_SPEC.md, RELEASE_SPEC.md

## Unreleased

### Changed

- Reduced BirdCoder server ownership to zero business tables, four System App
  API reads, zero Backend/Open operations, and four permissions.
- Standardized Project, composition, Session, Turn, Session Item, Interaction,
  Runtime Binding, Artifact, and Checkpoint integration on `sdkwork-agents`.
- Folded the retired workbench Workspace grouping into IAM organization scope
  plus canonical Agents Project.
- Standardized Skills on `sdkwork-skills` and human communication on
  `sdkwork-im`, while keeping AI Session Item semantics separate.
- Restricted Tauri SQLite to one allowlisted device-state table and canonical
  Project device mounts.
- Kept filesystem, Git, worktree, and terminal operations in PC/Tauri host
  adapters.
- Standardized sandbox composition on Agents `drive/drive` and document
  composition on Agents `document/documents` plus the Documents App SDK,
  without a BirdCoder binding table or projection.

### Removed

- BirdCoder server business DDL, migrations, repository/database host, and
  Project/Workspace routes and services.
- Parallel Project ids, Session systems, transcript persistence, remote
  project-path authority, copied dependency APIs, and obsolete documentation.
- Pre-launch projection, shadow-copy, dual-write, alias, and compatibility
  designs.

### Release Status

These changes remain unreleased until the complete Rust-and-PC verification and
production release gates pass.
