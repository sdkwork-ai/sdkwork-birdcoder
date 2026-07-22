# BirdCoder Workbench Database

This module is the single persistence authority for BirdCoder coding-workbench
facts. It owns exactly the ten `studio_` tables declared by
`../specs/domain-ownership.spec.json`; Agents sessions, assistant transcripts,
Skills, IM, IAM collaboration, Documents content, Appstore templates,
Deployments, Settings, and Commerce remain in their owning modules.

## Initialization

BirdCoder is pre-launch. Each engine therefore has one greenfield baseline in
`ddl/baseline/{engine}/0001_birdcoder_baseline.sql`. The migration directories
are reserved for changes created after the first production release. Generated
DDL under `ddl/generated/` is produced by `pnpm db:generate:ddl` and must not be
edited by hand.

Every runtime business table uses an application-preallocated
`BIGINT NOT NULL PRIMARY KEY`. Public resources use UUIDs. Cross-domain resource
ids are stable opaque references without database foreign keys.

## Commands

```bash
pnpm db:materialize:contract
pnpm db:generate:ddl
pnpm db:validate
pnpm db:plan
pnpm db:init
pnpm db:drift:check
```
