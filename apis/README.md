# BirdCoder API Catalog

This catalog lists only APIs owned by the BirdCoder application. The canonical request, response,
authentication, permission, and error contract is the authored OpenAPI document at
`../sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json`.

| Surface | Prefix | Operations | Authority |
| --- | --- | ---: | --- |
| App API | `/app/v3/api` | 39 | `sdkwork-birdcoder-app-api` |
| Backend API | None | 0 | None |
| Open API | None | 0 | None |

## App API Operations

### System

| Method | Path | operationId |
| --- | --- | --- |
| `GET` | `/app/v3/api/system/descriptor` | `descriptor.retrieve` |
| `GET` | `/app/v3/api/system/health` | `health.retrieve` |
| `GET` | `/app/v3/api/system/routes` | `routes.list` |
| `GET` | `/app/v3/api/system/runtime` | `runtime.retrieve` |

### Workspaces And Projects

| Method | Path | operationId |
| --- | --- | --- |
| `GET` | `/app/v3/api/workspaces` | `workspaces.list` |
| `POST` | `/app/v3/api/workspaces` | `workspaces.create` |
| `GET` | `/app/v3/api/workspaces/{workspaceId}` | `workspaces.retrieve` |
| `PATCH` | `/app/v3/api/workspaces/{workspaceId}` | `workspaces.update` |
| `DELETE` | `/app/v3/api/workspaces/{workspaceId}` | `workspaces.delete` |
| `GET` | `/app/v3/api/projects` | `projects.list` |
| `POST` | `/app/v3/api/projects` | `projects.create` |
| `GET` | `/app/v3/api/projects/{projectId}` | `projects.retrieve` |
| `PATCH` | `/app/v3/api/projects/{projectId}` | `projects.update` |
| `DELETE` | `/app/v3/api/projects/{projectId}` | `projects.delete` |

### Project Bindings

| Method | Path | operationId |
| --- | --- | --- |
| `GET` | `/app/v3/api/projects/{projectId}/document_bindings` | `projects.documentBindings.list` |
| `POST` | `/app/v3/api/projects/{projectId}/document_bindings` | `projects.documentBindings.create` |
| `GET` | `/app/v3/api/projects/{projectId}/document_bindings/{bindingId}` | `projects.documentBindings.retrieve` |
| `DELETE` | `/app/v3/api/projects/{projectId}/document_bindings/{bindingId}` | `projects.documentBindings.delete` |
| `GET` | `/app/v3/api/projects/{projectId}/sandbox_binding` | `projects.sandboxBinding.retrieve` |
| `PUT` | `/app/v3/api/projects/{projectId}/sandbox_binding` | `projects.sandboxBinding.update` |
| `DELETE` | `/app/v3/api/projects/{projectId}/sandbox_binding` | `projects.sandboxBinding.delete` |

### Runtime Locations

| Method | Path | operationId |
| --- | --- | --- |
| `GET` | `/app/v3/api/projects/{projectId}/runtime_locations` | `projects.runtimeLocations.list` |
| `POST` | `/app/v3/api/projects/{projectId}/runtime_locations` | `projects.runtimeLocations.create` |
| `GET` | `/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}` | `projects.runtimeLocations.retrieve` |
| `PATCH` | `/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}` | `projects.runtimeLocations.update` |
| `DELETE` | `/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}` | `projects.runtimeLocations.delete` |
| `POST` | `/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}/rebind` | `projects.runtimeLocations.rebind` |
| `POST` | `/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}/request_verification` | `projects.runtimeLocations.requestVerification` |
| `GET` | `/app/v3/api/projects/{projectId}/runtime_location_preferences` | `projects.runtimeLocations.preferences.list` |
| `PUT` | `/app/v3/api/projects/{projectId}/runtime_location_preferences/{capability}` | `projects.runtimeLocations.preferences.update` |

### Project Git

| Method | Path | operationId |
| --- | --- | --- |
| `GET` | `/app/v3/api/projects/{projectId}/git/overview` | `projects.git.overview.retrieve` |
| `GET` | `/app/v3/api/projects/{projectId}/git/diff` | `projects.git.diff.retrieve` |
| `POST` | `/app/v3/api/projects/{projectId}/git/branches` | `projects.git.branches.create` |
| `POST` | `/app/v3/api/projects/{projectId}/git/switch_branch` | `projects.git.switchBranch` |
| `POST` | `/app/v3/api/projects/{projectId}/git/commits` | `projects.git.commits.create` |
| `POST` | `/app/v3/api/projects/{projectId}/git/push` | `projects.git.push` |
| `POST` | `/app/v3/api/projects/{projectId}/git/worktrees` | `projects.git.worktrees.create` |
| `POST` | `/app/v3/api/projects/{projectId}/git/remove_worktree` | `projects.git.removeWorktree` |
| `POST` | `/app/v3/api/projects/{projectId}/git/prune_worktrees` | `projects.git.pruneWorktrees` |

## Ownership Boundary

Agents sessions, turns, session items, interactions, runtime bindings, artifacts, and checkpoints are
consumed from the Agents App SDK. Skills, saved prompts, document content, IAM, human IM,
membership, commerce, and deployment operations are consumed from their owner SDK families. They
are intentionally absent from the BirdCoder API authority and are not counted above.

Application code consumes generated SDK clients through injected services. Raw HTTP, manual auth
headers, dependency DTO copies, and local SDK forks are forbidden. Successful responses use the
SDKWork response envelope; failures use RFC 9457 `application/problem+json`.

## Verification

```bash
node scripts/sync-birdcoder-sdk-openapi.mjs --check
node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --root .
node ../sdkwork-specs/tools/check-api-response-envelope.mjs --root .
pnpm check:sdk-family-standard
pnpm check:sdk-family-generated
```
