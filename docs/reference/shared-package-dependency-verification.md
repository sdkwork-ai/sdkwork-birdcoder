# Workspace Dependency Verification

Native package and workspace manifests are the dependency authority.

## Owner SDK Boundary

| Capability | Required owner package |
| --- | --- |
| Project, composition, Session, Runtime Binding | Agents App SDK |
| Skills | Skills App SDK |
| Human communication | IM App SDK |
| Identity and organization scope | IAM SDK/runtime |
| Sandbox storage | Drive App SDK |
| Documents | Documents App SDK |
| BirdCoder System metadata | BirdCoder App SDK |

Application composition creates one client per owner endpoint with the shared
TokenManager and injects bounded services into features. A package must not
replace an unresolved workspace dependency with raw HTTP, private source,
copied generated code, or a local compatibility package.

## Sources

- `pnpm-workspace.yaml` and package `package.json` files
- root and module `component.spec.json`
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
