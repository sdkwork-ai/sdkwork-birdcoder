# Agent Session Item UI Contract

BirdCoder displays AI-assistant transcripts from the canonical
`sdkwork-agents` Session Item API. A displayed transcript row is an ephemeral
UI view model, not a BirdCoder business entity, IM message, database record,
projection, cache authority, or replay-built read model.

## Ownership

- `sdkwork-agents` owns Agent Project, Session, Turn, Session Item,
  Interaction, Runtime Binding, Artifact, and Checkpoint facts.
- BirdCoder owns only coding-workbench state and the presentation of Agents
  facts in its workbench surfaces.
- `sdkwork-im` owns human Conversation, Message, Member, and ReadCursor facts.
  Agent Session Items must never be persisted or exposed as IM Messages.

## Integration

- Bootstrap code constructs one generated Agents App SDK client with the
  application-wide TokenManager.
- A feature service receives that client by injection and exposes bounded,
  paginated Session, Turn, Session Item, and Interaction operations.
- UI components depend on the feature service or a port. They do not construct
  SDK clients, send raw HTTP requests, set authentication headers, or import a
  local copy of generated DTOs.
- Sending user input uses the canonical Agents turn-completion workflow.
  Reading a transcript uses the Session Item list authority.

## View Model

The in-memory adapter may derive rendering-only properties such as grouping,
markdown blocks, tool activity rows, pending-interaction affordances, and copy
text. It must preserve the canonical Session Item id, kind, ordering cursor,
timestamps, and source payload needed for deterministic rendering.

The adapter must not persist derived state, invent a second lifecycle, accept
IM delivery semantics, or use the terms `projection` or `message authority`.
Unknown Session Item kinds are rendered with a safe generic representation and
must not be silently discarded.

## Verification

```bash
node --experimental-strip-types scripts/agent-session-item-view-contract.test.ts
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
```
