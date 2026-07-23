# Workspace Dependency Verification

Native package and workspace manifests are the dependency authority.

## PC Runtime SDK Inventory

The PC component contract is the single runtime inventory. Its required SDK
families are:

| Capability | Required SDK family |
| --- | --- |
| BirdCoder System metadata | `sdkwork-birdcoder-app-sdk` |
| Project, composition, Session, Turn, Session Item, Interaction, Checkpoint, Runtime Binding | `sdkwork-agents-app-sdk` |
| Documents | `sdkwork-documents-app-sdk` |
| Drive and sandbox storage | `sdkwork-drive-app-sdk` |
| Identity and organization scope | `sdkwork-iam-app-sdk` |
| Membership and benefits | `sdkwork-membership-app-sdk` |
| External delivery and notifications | `sdkwork-messaging-app-sdk` |
| Orders | `sdkwork-order-app-sdk` |
| Saved prompts | `sdkwork-prompts-app-sdk` |
| Skills | `sdkwork-skills-app-sdk` |

Human Conversation, Message, Member, and ReadCursor facts remain owned by
`sdkwork-im`, but the current PC surface has no independent human messaging
feature and therefore no required IM SDK consumer. Enabling such a feature
must add an explicit PC component dependency without changing Agents Session
Item semantics.

Application composition creates one client per owner endpoint with the shared
TokenManager and injects bounded services into features. A package must not
replace an unresolved workspace dependency with raw HTTP, private source,
copied generated code, or a local compatibility package.

## Sources

- `pnpm-workspace.yaml` and package `package.json` files
- `apps/sdkwork-birdcoder-pc/specs/component.spec.json` for the runtime SDK inventory
- root and module `component.spec.json` for composition boundaries
- owner SDK `sdk-manifest.json`
- `specs/domain-ownership.spec.json`

## Verification

```bash
pnpm install --frozen-lockfile
pnpm check:dependency-management
pnpm check:app-composition
pnpm check:package-governance
pnpm check:api-transport-standard
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
```
