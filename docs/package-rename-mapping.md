# Package Rename Mapping

## Analysis

Based on APP_PC_ARCHITECTURE_SPEC.md and NAMING_SPEC.md, packages should be categorized as:

### Shared Packages (Keep Current Naming)
These packages provide cross-platform functionality and should remain as `sdkwork-birdcoder-*`:

| Current Directory | Current package.json name | New package.json name | Reason |
|---|---|---|---|
| sdkwork-birdcoder-core | @sdkwork/birdcoder-core | @sdkwork/birdcoder-core | Foundation functionality |
| sdkwork-birdcoder-types | @sdkwork/birdcoder-types | @sdkwork/birdcoder-types | Shared type definitions |
| sdkwork-birdcoder-i18n | @sdkwork/birdcoder-i18n | @sdkwork/birdcoder-i18n | Shared internationalization |
| sdkwork-birdcoder-commons | @sdkwork/birdcoder-commons | @sdkwork/birdcoder-commons | Shared common utilities |
| sdkwork-birdcoder-infrastructure | @sdkwork/birdcoder-infrastructure | @sdkwork/birdcoder-infrastructure | Shared infrastructure |
| sdkwork-birdcoder-shell | @sdkwork/birdcoder-shell | @sdkwork/birdcoder-shell | Shared shell components |
| sdkwork-birdcoder-iam | @sdkwork/birdcoder-iam | @sdkwork/birdcoder-iam | Shared IAM functionality |
| sdkwork-birdcoder-auth | @sdkwork/birdcoder-auth | @sdkwork/birdcoder-auth | Shared auth functionality |
| sdkwork-birdcoder-user | @sdkwork/birdcoder-user | @sdkwork/birdcoder-user | Shared user functionality |
| sdkwork-birdcoder-settings | @sdkwork/birdcoder-settings | @sdkwork/birdcoder-settings | Shared settings functionality |
| sdkwork-birdcoder-distribution | @sdkwork/birdcoder-distribution | @sdkwork/birdcoder-distribution | Shared distribution functionality |
| sdkwork-birdcoder-skills | @sdkwork/birdcoder-skills | @sdkwork/birdcoder-skills | Shared skills functionality |
| sdkwork-birdcoder-templates | @sdkwork/birdcoder-templates | @sdkwork/birdcoder-templates | Shared templates functionality |

### PC-Specific Packages (Rename to PC Format)
These packages are specific to the PC application surface and should be renamed to `sdkwork-birdcoder-pc-*`:

| Current Directory | Current package.json name | New Directory | New package.json name | Reason |
|---|---|---|---|---|
| sdkwork-birdcoder-web | @sdkwork/birdcoder-web | sdkwork-birdcoder-pc-web | @sdkwork/birdcoder-pc-web | PC web delivery target |
| sdkwork-birdcoder-desktop | @sdkwork/birdcoder-desktop | sdkwork-birdcoder-pc-desktop | @sdkwork/birdcoder-pc-desktop | PC desktop delivery target |
| sdkwork-birdcoder-code | @sdkwork/birdcoder-code | sdkwork-birdcoder-pc-code | @sdkwork/birdcoder-pc-code | PC code editing functionality |
| sdkwork-birdcoder-studio | @sdkwork/birdcoder-studio | sdkwork-birdcoder-pc-studio | @sdkwork/birdcoder-pc-studio | PC studio functionality |
| sdkwork-birdcoder-chat | @sdkwork/birdcoder-chat | sdkwork-birdcoder-pc-chat | @sdkwork/birdcoder-pc-chat | PC chat functionality |
| sdkwork-birdcoder-chat-claude | @sdkwork/birdcoder-chat-claude | sdkwork-birdcoder-pc-chat-claude | @sdkwork/birdcoder-pc-chat-claude | PC Claude chat integration |
| sdkwork-birdcoder-chat-codex | @sdkwork/birdcoder-chat-codex | sdkwork-birdcoder-pc-chat-codex | @sdkwork/birdcoder-pc-chat-codex | PC Codex chat integration |
| sdkwork-birdcoder-chat-gemini | @sdkwork/birdcoder-chat-gemini | sdkwork-birdcoder-pc-chat-gemini | @sdkwork/birdcoder-pc-chat-gemini | PC Gemini chat integration |
| sdkwork-birdcoder-chat-opencode | @sdkwork/birdcoder-chat-opencode | sdkwork-birdcoder-pc-chat-opencode | @sdkwork/birdcoder-pc-chat-opencode | PC OpenCode chat integration |
| sdkwork-birdcoder-codeengine | @sdkwork/birdcoder-codeengine | sdkwork-birdcoder-pc-codeengine | @sdkwork/birdcoder-pc-codeengine | PC code engine functionality |
| sdkwork-birdcoder-host-core | @sdkwork/birdcoder-host-core | sdkwork-birdcoder-pc-host-core | @sdkwork/birdcoder-pc-host-core | PC host core functionality |
| sdkwork-birdcoder-host-studio | @sdkwork/birdcoder-host-studio | sdkwork-birdcoder-pc-host-studio | @sdkwork/birdcoder-pc-host-studio | PC host studio functionality |
| sdkwork-birdcoder-shell-runtime | @sdkwork/birdcoder-shell-runtime | sdkwork-birdcoder-pc-shell-runtime | @sdkwork/birdcoder-pc-shell-runtime | PC shell runtime |
| sdkwork-birdcoder-infrastructure-runtime | @sdkwork/birdcoder-infrastructure-runtime | sdkwork-birdcoder-pc-infrastructure-runtime | @sdkwork/birdcoder-pc-infrastructure-runtime | PC infrastructure runtime |
| sdkwork-birdcoder-multiwindow | @sdkwork/birdcoder-multiwindow | sdkwork-birdcoder-pc-multiwindow | @sdkwork/birdcoder-pc-multiwindow | PC multi-window functionality |
| sdkwork-birdcoder-server | @sdkwork/birdcoder-server | sdkwork-birdcoder-pc-server | @sdkwork/birdcoder-pc-server | PC server functionality |
| sdkwork-birdcoder-ui | @sdkwork/birdcoder-ui | sdkwork-birdcoder-pc-ui | @sdkwork/birdcoder-pc-ui | PC UI components |
| sdkwork-birdcoder-ui-shell | @sdkwork/birdcoder-ui-shell | sdkwork-birdcoder-pc-ui-shell | @sdkwork/birdcoder-pc-ui-shell | PC UI shell |
| sdkwork-birdcoder-workbench-state | @sdkwork/birdcoder-workbench-state | sdkwork-birdcoder-pc-workbench-state | @sdkwork/birdcoder-pc-workbench-state | PC workbench state |
| sdkwork-birdcoder-workbench-storage | @sdkwork/birdcoder-workbench-storage | sdkwork-birdcoder-pc-workbench-storage | @sdkwork/birdcoder-pc-workbench-storage | PC workbench storage |
| sdkwork-birdcoder-git | @sdkwork/birdcoder-git | sdkwork-birdcoder-pc-git | @sdkwork/birdcoder-pc-git | PC git functionality |

## Migration Steps

1. Rename directories (for PC-specific packages)
2. Update package.json name fields
3. Update pnpm-workspace.yaml
4. Update all internal dependency references
5. Update all import statements
6. Update all script references
7. Update documentation
8. Run verification commands

## Verification Commands

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run check:package-governance
pnpm run build
```
