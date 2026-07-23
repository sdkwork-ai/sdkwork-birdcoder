# Package Boundaries

The PC application follows the package families declared under
`apps/sdkwork-birdcoder-pc/packages/`. Native package manifests and exports
are the dependency authority; this page records only the architectural roles.

| Role | Responsibility |
| --- | --- |
| Shell and runtime composition | Routes, TokenManager, owner SDK clients, host adapters |
| Workbench | Project/Session orchestration and disposable UI state |
| Infrastructure | Generated SDK adapters and PC host capability services |
| Contracts commons | Rendering and service-port types, not business DTO forks |
| Code, Studio, Multiwindow | Feature presentation and commands |
| Desktop/Web hosts | Target-specific startup and packaging |

Project and Session business contracts come from Agents. Skill, IM, IAM,
Drive, and Documents contracts come from their owner packages. PC packages
must not own a duplicate transport, persistence schema, or domain lifecycle.

Verification:

```bash
pnpm check:package-governance
pnpm check:package-subpath-exports
pnpm check:app-composition
```
