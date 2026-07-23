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
backup archive. Redis and in-memory gateway state are rebuildable and are not a
BirdCoder system of record.

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
