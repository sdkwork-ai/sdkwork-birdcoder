# SDKWork BirdCoder PC Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-23
Specs: DOCUMENTATION_SPEC.md, ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md

This document narrows the
[repository technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
to PC. The repository document remains the architecture Canon.

## Composition Root

The PC shell/runtime owns route bootstrap, runtime configuration, the shared
TokenManager, generated owner SDK clients, and browser/Tauri host adapters.
Features receive typed services or ports. They do not construct HTTP clients,
read private environment values, set authentication headers, or import
generated transport internals.

## Connectivity

| Plane | Clients |
| --- | --- |
| BirdCoder application ingress | Four-operation BirdCoder System SDK |
| Platform gateway or owner override | Agents, Skills, IAM, Drive, Documents, Messaging, Membership, Order, Prompts |

Browser development may use the declared platform proxy. Desktop requires an
explicit platform endpoint. An unavailable required plane fails before feature
bootstrap.

## Project And Session

```text
IAM organization scope
  -> Agents Project (projectId)
       -> composition slot
       -> Session
            -> Turn
            -> Session Item
            -> Interaction
            -> Runtime Binding
```

PC view models preserve the owner `projectId` and Session identifiers. There
is no Workspace bootstrap, second Project id, parallel Session id, persistent
transcript view, or mapping facade.

Session creation and local execution context use:

1. the selected canonical `projectId`;
2. a subject-scoped `ProjectDeviceMountRegistry` record;
3. the Agents Session;
4. Agents `sessionRuntimeBindings` with the opaque Tauri runtime id.

## Host Boundary

Browser directory handles stay in browser capability storage. Tauri commands
own native directory selection, canonicalization, filesystem operations, Git,
worktrees, terminals, and allowlisted device state.

The Tauri SQLite table `device_state_entry` is not a business store. It cannot
contain Project, Session, Conversation, Message, Skill, transcript, or owner
SDK response records. Missing or unauthorized local capability fails closed.

## Composition Slots

- Sandbox: Agents `drive/drive`, with Drive as the target owner.
- Document: Agents `document/documents`; Documents owns content, versions,
  permissions, and lifecycle, while Agents stores only target references.

PC does not cast or serialize an unsupported slot value to bypass the owner
contract.

## Data Naming And Ownership

PC owns no business tables. Agents Project and Session records remain in the
`sdkwork-agents` database authority and are outside the BirdCoder database
design. The PC surface does not define aliases, projections, compatibility
tables, or an additional Workspace, Project, Session, Conversation, Message,
or transcript authority.

Human communication remains the `sdkwork-im` Conversation/Message domain and
must never be represented as an Agents Session Item. Product AI Skills remain
owned by `sdkwork-skills`. The only PC physical table is the allowlisted local
`device_state_entry` host store described above; it is not synchronized as a
business record.

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test
pnpm --dir apps/sdkwork-birdcoder-pc check
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
```

The app-local commands verify only the PC source graph and its source-linked
SDK dependencies. Cross-surface aggregation remains a repository-root concern.
