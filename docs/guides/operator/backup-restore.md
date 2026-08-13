# Recovery And Backup Ownership

Updated: 2026-07-23
Specs: `DEPLOYMENT_SPEC.md`, `RELEASE_SPEC.md`, `SECURITY_SPEC.md`

## Ownership Boundary

BirdCoder is a stateless composition host and has no business database to back
up or restore. Domain recovery follows the owning module:

| Facts | Recovery owner |
| --- | --- |
| Project, composition, Session, Turn, Session Item, interaction, checkpoint, and runtime binding | `sdkwork-agents` |
| Skill package, version, capability, installation, asset, and action | `sdkwork-skills` |
| Human conversation, message, member, and read cursor | `sdkwork-im` |
| Identity, organization, role, permission, and credential | `sdkwork-iam` |

BirdCoder does not copy these facts into a local mirror. A coordinated recovery
selects mutually compatible owner recovery points and validates references via
the owner SDK contracts before reopening traffic.

## Gateway Recovery

1. Select the last verified immutable server or container artifact.
2. Restore its matching topology profile, exact CORS origins, dependency
   endpoints, and operator-managed credentials.
3. Start one stateless replica and verify `/healthz`, `/readyz`, `/metrics`, and
   the four-operation owner OpenAPI document.
4. Verify authentication and one read-only owner-module request through each
   required generated SDK.
5. Restore traffic, then scale replicas or apply `values-ha.yaml`.

There is no BirdCoder schema replay, data-volume restore, migration job, or
backup archive. In-memory gateway state (the bounded synchronization refresh
cache and in-flight registry) is rebuildable and is not a BirdCoder system of
record.

## Deployments Module Database

When the gateway is configured with a workspace PostgreSQL profile
(`SDKWORK_DATABASE_URL` or the structured `SDKWORK_DATABASE_*` fields), the
gateway bootstraps the SDKWork Deployments owner module and that module owns
`deploy_*` tables in the shared PostgreSQL database. Those tables are owned by
`sdkwork-deployments` (not by BirdCoder) and follow that module's backup
lifecycle: back up and restore the shared PostgreSQL database with the owner
`pg_dump`/restore procedure before any traffic reopens, exactly like the other
owner modules. Without a workspace PostgreSQL profile the gateway serves the
stateless profile and owns no database at all.

## PC Device Recovery

PC/Tauri device state is local capability material, not server backup data. If
it is lost, restore application settings where supported, reselect local
project folders, and rebuild the `ProjectDeviceMountRegistry` using canonical
Agents `projectId` values. Never upload native paths or the device-state file to
the gateway as recovery data.

Agents Session runtime bindings contain opaque runtime location identifiers,
not recoverable local filesystem paths. A missing local mount fails closed and
requires user-authorized rebinding on that device.

## Release Evidence

Retain the immutable release manifest, checksums, attestations, SBOM, owner
OpenAPI, SDK manifests, topology profile, and rollback plan together. Recovery
is complete only when the deployed artifact and configuration match that
evidence and all required owner dependencies pass their own recovery checks.
