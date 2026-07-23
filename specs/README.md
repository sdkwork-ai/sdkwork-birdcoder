# SDKWork BirdCoder Specs

This directory is the human index for BirdCoder application contracts. Machine
authority lives in the JSON manifests in this directory and in the authored
OpenAPI; global SDKWork rules remain in
[`../../sdkwork-specs/`](../../sdkwork-specs/README.md).

## Current Contract

| Boundary | Current value | Authority |
| --- | ---: | --- |
| Server business tables | 0 | [`domain-ownership.spec.json`](domain-ownership.spec.json) |
| BirdCoder App API operations | 4 | [BirdCoder App OpenAPI](../sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json) |
| BirdCoder Backend API operations | 0 | [`domain-ownership.spec.json`](domain-ownership.spec.json) |
| BirdCoder Open API operations | 0 | [`domain-ownership.spec.json`](domain-ownership.spec.json) |
| BirdCoder IAM permissions | 4 | [`iam.module.manifest.json`](iam.module.manifest.json) |

BirdCoder owns System descriptor, health, routes, and runtime metadata only. It
has no server persistence authority.

## Dependency Ownership

| Owner | External facts and integration state |
| --- | --- |
| `sdkwork-agents` | Project, composition, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, Checkpoint |
| `sdkwork-skills` | Skill package, version, artifact, capability, installation |
| `sdkwork-im` | Owns Human Conversation, Message, Member, and ReadCursor; consumed only when an independent human messaging feature is enabled |
| `sdkwork-iam` | Authentication, organization scope, membership, authorization, audit |
| `sdkwork-drive` | Drive and sandbox storage |
| `sdkwork-documents` | Document identity and content |

The former workbench Workspace is not migrated into another BirdCoder
aggregate. Its grouping scope is IAM organization context and its project
identity is the canonical Agents `AgentProject`. PC state carries one
`projectId`.

AI assistant rows are rendering views over Agents Session Items, not IM
Messages. The exact UI boundary is
[`agent-session-item-view.spec.md`](agent-session-item-view.spec.md).

## Local Contracts

- [`component.spec.json`](component.spec.json) declares the root component.
- [`domain-ownership.spec.json`](domain-ownership.spec.json) declares the
  zero-table, four-operation ownership boundary and dependency direction.
- [`iam.module.manifest.json`](iam.module.manifest.json) declares the four
  System read permissions.
- [`topology.spec.json`](topology.spec.json) declares runtime topology.
- [`agents-birdcoder-alignment.spec.json`](agents-birdcoder-alignment.spec.json)
  records canonical Agents integration.
- [`kernel-birdcoder-alignment.spec.json`](kernel-birdcoder-alignment.spec.json)
  enforces `BirdCoder -> Agents -> Kernel`.

These contracts prohibit a local business database, copied dependency API,
persistent read authority, dual identifier, or compatibility transport.

## Canonical Standards

- [`DOMAIN_SPEC.md`](../../sdkwork-specs/DOMAIN_SPEC.md)
- [`API_SPEC.md`](../../sdkwork-specs/API_SPEC.md)
- [`SDK_SPEC.md`](../../sdkwork-specs/SDK_SPEC.md)
- [`APP_SDK_INTEGRATION_SPEC.md`](../../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md)
- [`DATABASE_SPEC.md`](../../sdkwork-specs/DATABASE_SPEC.md)
- [`SECURITY_SPEC.md`](../../sdkwork-specs/SECURITY_SPEC.md)
- [`DOCUMENTATION_SPEC.md`](../../sdkwork-specs/DOCUMENTATION_SPEC.md)

## Verification

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:arch
```
