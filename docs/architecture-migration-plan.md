# SDKWork Birdcoder Architecture Migration Plan

## Executive Summary

This plan migrates the sdkwork-birdcoder repository from a single-PC-app-root-with-duplicates structure to a multi-surface repository with three app roots (PC, H5, Flutter Mobile) sharing common packages at the repository root.

## Current State Analysis

### Repository Root Inventory

| Path | Status | Action |
|------|--------|--------|
| `packages/` (34 dirs) | Duplicate of `apps/sdkwork-birdcoder-pc/packages/` | Keep shared (13), remove PC-specific (21) duplicates |
| `sdks/` | Duplicate of `apps/sdkwork-birdcoder-pc/sdks/` | Canonical source stays in `apps/sdkwork-birdcoder-pc/sdks/`; root symlink or pnpm reference |
| `src/` | Root shell (App.tsx, main.tsx, bootstrap) | Remove - this is PC app entry, belongs in PC app root |
| `index.html` | PC browser entry | Remove - belongs in PC app root |
| `vite.config.ts` | PC Vite config | Remove - belongs in PC app root |
| `tsconfig.json` | PC TypeScript config | Remove - belongs in PC app root |
| `tsconfig.base.json` | Shared TS base config | Keep - shared across app roots |
| `Cargo.toml` | Rust workspace for PC crates | Keep at root - Rust crates are workspace-wide |
| `pnpm-workspace.yaml` | Root workspace config | Update - reference shared packages + app root packages |
| `package.json` | Root workspace with 625 scripts | Update - remove PC-specific scripts, keep shared |
| `config/` | 1 file | Merge into `configs/` |
| `configs/` | 2 files | Keep as canonical config directory |
| `deploy/` | docker/ + kubernetes/ | Merge into `deployments/` |
| `deployments/` | docker/ + kubernetes/ + server | Keep as canonical deployment directory |
| `server/` | Pre-built binaries (win32/, windows/) | Move into `deployments/server/` |
| `external/` | Vendored AI agent sources | Keep - shared resource |
| `artifacts/` | OpenAPI specs | Move to `sdks/` or keep as build output |
| `apis/` | Empty | Populate with OpenAPI contracts or remove placeholder |
| `crates/` | Empty | Populate with Rust crate references or keep placeholder |
| `scripts/` | 625 scripts | Classify: shared (~200) vs PC-specific (~425) |

### Package Classification

**Shared packages (13) - stay at root `packages/`:**
These packages have no `pc` segment and are reusable across all app surfaces.

| Package | Purpose | Cross-app? |
|---------|---------|------------|
| `sdkwork-birdcoder-auth` | Auth utilities | Yes |
| `sdkwork-birdcoder-commons` | Domain-neutral components | Yes |
| `sdkwork-birdcoder-core` | Core runtime | Yes |
| `sdkwork-birdcoder-distribution` | Distribution utilities | Yes |
| `sdkwork-birdcoder-i18n` | Internationalization | Yes |
| `sdkwork-birdcoder-iam` | IAM integration | Yes |
| `sdkwork-birdcoder-infrastructure` | Infrastructure layer | Yes |
| `sdkwork-birdcoder-settings` | Settings | Yes |
| `sdkwork-birdcoder-shell` | Shell framework | Yes |
| `sdkwork-birdcoder-skills` | Skills framework | Yes |
| `sdkwork-birdcoder-templates` | Templates | Yes |
| `sdkwork-birdcoder-types` | Shared types | Yes |
| `sdkwork-birdcoder-user` | User model | Yes |

**PC-specific packages (21) - stay in `apps/sdkwork-birdcoder-pc/packages/`:**
These packages have the `pc` segment and are PC-surface-only.

| Package | Role |
|---------|------|
| `sdkwork-birdcoder-pc-chat` | App capability |
| `sdkwork-birdcoder-pc-chat-claude` | App capability |
| `sdkwork-birdcoder-pc-chat-codex` | App capability |
| `sdkwork-birdcoder-pc-chat-gemini` | App capability |
| `sdkwork-birdcoder-pc-chat-opencode` | App capability |
| `sdkwork-birdcoder-pc-code` | App capability |
| `sdkwork-birdcoder-pc-codeengine` | App capability |
| `sdkwork-birdcoder-pc-desktop` | Native host (Tauri) |
| `sdkwork-birdcoder-pc-git` | App capability |
| `sdkwork-birdcoder-pc-host-core` | Host runtime |
| `sdkwork-birdcoder-pc-host-studio` | Host capability |
| `sdkwork-birdcoder-pc-infrastructure-runtime` | PC infrastructure |
| `sdkwork-birdcoder-pc-multiwindow` | PC capability |
| `sdkwork-birdcoder-pc-server` | Server host |
| `sdkwork-birdcoder-pc-shell-runtime` | PC shell runtime |
| `sdkwork-birdcoder-pc-studio` | App capability |
| `sdkwork-birdcoder-pc-ui` | PC UI primitives |
| `sdkwork-birdcoder-pc-ui-shell` | PC UI shell |
| `sdkwork-birdcoder-pc-web` | Web host |
| `sdkwork-birdcoder-pc-workbench-state` | PC state |
| `sdkwork-birdcoder-pc-workbench-storage` | PC storage |

### Cross-Repository Dependencies (18 packages)

From `pnpm-workspace.yaml`, these sibling SDKWork repositories are consumed:

| Sibling Repo | Packages Used |
|-------------|---------------|
| `sdkwork-appbase` | IAM contracts/runtime/adapters/ports/service, runtime-bootstrap, appbase app/backend SDK, PC-react foundation, auth-runtime, auth, user |
| `sdkwork-sdk-commons` | SDK common typescript |
| `sdkwork-search` | Search contracts, search PC-react |
| `sdkwork-core` | Core PC-react |
| `sdkwork-ui` | UI PC-react |
| `sdkwork-terminal` | Desktop app, infrastructure, shell |
| `sdkwork-drive` | Drive app SDK |
| `sdkwork-messaging` | Messaging app SDK |

---

## Key Architecture Decisions

### Decision 1: Shared Package Location

**Decision**: Keep shared packages at repository root `packages/`.

**Rationale**: Per `SDKWORK_WORKSPACE_SPEC.md` §1.1, top-level `packages/` is allowed when "a shared package repository is explicitly governed by an architecture/package standard that names `packages/` as its root collection." The 13 shared packages (no `pc`/`h5`/`flutter` segment) are cross-surface and belong at the workspace root.

**Implementation**:
- Root `pnpm-workspace.yaml` includes `packages/sdkwork-birdcoder-*` (shared)
- Each app root's `pnpm-workspace.yaml` includes its own `packages/sdkwork-birdcoder-<arch>-*` plus references to root shared packages via workspace protocol
- Shared packages are NOT duplicated in app roots

### Decision 2: Rust Crate Location

**Decision**: Keep Rust workspace at repository root `Cargo.toml`.

**Rationale**: Rust crates (`pc-server`, `pc-desktop`, `pc-codeengine`, `pc-git`, `pc-host-studio`) are workspace-wide build artifacts. The root `Cargo.toml` workspace members already reference `apps/sdkwork-birdcoder-pc/packages/*/src-host`. New app roots that need Rust crates (unlikely for H5/Flutter) would add members to the same workspace.

### Decision 3: SDK Location

**Decision**: Canonical SDKs live in each app root's `sdks/` directory. Root `sdks/` becomes a thin reference or is removed.

**Rationale**: Per `SDK_WORKSPACE_GENERATION_SPEC.md`, SDK families are application-root-owned. Each app root generates its own SDK clients. The root `sdks/` currently duplicates `apps/sdkwork-birdcoder-pc/sdks/`.

### Decision 4: Script Classification

**Decision**: Split 625 root scripts into shared (~100) and PC-specific (~525).

**Classification criteria**:
- Scripts that reference `packages/sdkwork-birdcoder-pc-*` → move to `apps/sdkwork-birdcoder-pc/scripts/`
- Scripts that are generic workspace tooling (run-quality, run-release, etc.) → stay at root `scripts/`
- Test contract scripts that test PC-specific behavior → move to PC app root
- Scripts that test shared package behavior → stay at root

### Decision 5: Config Consolidation

**Decision**: Merge `config/` into `configs/`. Keep `configs/` as the canonical project-root config directory per `SDKWORK_WORKSPACE_SPEC.md`.

### Decision 6: Deployment Consolidation

**Decision**: Merge `deploy/` into `deployments/`. Move `server/` binaries into `deployments/server/`. Keep `deployments/` as canonical per spec.

---

## Target State

```text
sdkwork-birdcoder/                          # Repository root (multi-surface workspace)
  AGENTS.md
  CLAUDE.md
  GEMINI.md
  CODEX.md
  sdkwork.app.config.json                   # Root app config (multi-surface)
  .sdkwork/
    README.md
    skills/
    plugins/
  apis/                                     # OpenAPI contracts (from artifacts/)
    README.md
    open-api/
  apps/
    README.md
    sdkwork-birdcoder-pc/                   # PC app root (existing, cleaned up)
      AGENTS.md
      sdkwork.app.config.json
      .sdkwork/
      config/                               # browser/desktop/server/container/tauri
      packages/                             # 21 PC-specific packages
      sdks/                                 # PC SDK families
      scripts/                              # PC-specific scripts
      specs/
      src/                                  # Thin PC bootstrap
      tests/
      index.html
      package.json
      pnpm-workspace.yaml
      tsconfig.json
      vite.config.ts
    sdkwork-birdcoder-h5/                   # H5 app root (NEW)
      AGENTS.md
      sdkwork.app.config.json
      .sdkwork/
      config/                               # browser/host/server/container
      packages/                             # H5-specific packages
      sdks/                                 # H5 SDK families
      scripts/
      specs/
      src/                                  # Thin H5 bootstrap
      tests/
      index.html
      package.json
      pnpm-workspace.yaml
      tsconfig.json
      vite.config.ts
    sdkwork-birdcoder-flutter-mobile/       # Flutter app root (NEW)
      AGENTS.md
      sdkwork.app.config.json
      .sdkwork/
      config/                               # app/host/server/container
      packages/                             # Flutter-specific packages
      sdks/                                 # Flutter Dart SDK families
      scripts/
      specs/
      lib/                                  # Thin Flutter bootstrap
      test/
      pubspec.yaml
  crates/                                   # Rust crates (workspace members)
    README.md
  sdks/                                     # Shared SDK specs/authorities (thin)
    README.md
    specs/
  jobs/
    README.md
  tools/
    README.md
  plugins/
    README.md
  examples/
    README.md
  configs/                                  # Shared config templates
    README.md
    shared-sdk-release-sources.json
  deployments/                              # Deployment descriptors
    README.md
    docker/
    kubernetes/
    server/
  scripts/                                  # Shared workspace scripts (~100)
    README.md
  docs/
    README.md
    architecture-migration-plan.md
  tests/
    README.md
  external/                                 # Vendored AI agent sources
    claude-code/
    codex/
    gemini/
    opencode/
  packages/                                 # Shared cross-surface packages (13)
    sdkwork-birdcoder-auth/
    sdkwork-birdcoder-commons/
    sdkwork-birdcoder-core/
    sdkwork-birdcoder-distribution/
    sdkwork-birdcoder-i18n/
    sdkwork-birdcoder-iam/
    sdkwork-birdcoder-infrastructure/
    sdkwork-birdcoder-settings/
    sdkwork-birdcoder-shell/
    sdkwork-birdcoder-skills/
    sdkwork-birdcoder-templates/
    sdkwork-birdcoder-types/
    sdkwork-birdcoder-user/
  pnpm-workspace.yaml                       # Root workspace config
  package.json                              # Root package.json
  Cargo.toml                                # Rust workspace
  tsconfig.base.json                        # Shared TS base config
```

---

## Phase-by-Phase Migration Plan

### Phase 0: Preparation & Baseline Verification

**Goal**: Establish that the current codebase is healthy before any changes.

**Steps**:
1. Run full verification suite on current codebase:
   ```bash
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm lint
   pnpm check:arch
   pnpm check:package-governance
   ```
2. Create migration branch: `feat/multi-surface-architecture`
3. Document current build state and any existing failures
4. Back up current `pnpm-workspace.yaml`, `package.json`, `Cargo.toml`

**Risk**: None (read-only)
**Estimated effort**: 1-2 hours

---

### Phase 1: Clean Up Root-Level Duplicates

**Goal**: Remove root-level files that duplicate `apps/sdkwork-birdcoder-pc/` content.

#### Step 1.1: Remove Root PC Entry Files

Delete these root-level files that are PC-app-specific duplicates:

| File | Reason |
|------|--------|
| `src/` | PC app entry (App.tsx, main.tsx, bootstrap) - exists in PC app root |
| `index.html` | PC browser entry - exists in PC app root |
| `vite.config.ts` | PC Vite config - exists in PC app root |
| `tsconfig.json` | PC TypeScript config - exists in PC app root |
| `tsconfig.runtime.json` | PC runtime TS config |
| `tsconfig.scripts.json` | Scripts TS config - keep if shared scripts need it |

**Verification**: `pnpm typecheck` from `apps/sdkwork-birdcoder-pc/` still passes.

#### Step 1.2: Consolidate Config Directories

Merge `config/` into `configs/`:

```bash
# Move config/shared-sdk-release-sources.json to configs/
mv config/shared-sdk-release-sources.json configs/
# Remove empty config/
rmdir config/
```

Update any references to `config/` in scripts.

**Verification**: No broken imports or script references.

#### Step 1.3: Consolidate Deployment Directories

Merge `deploy/` into `deployments/`:

```bash
# Move deploy/ contents into deployments/
mv deploy/docker/* deployments/docker/
mv deploy/kubernetes/* deployments/kubernetes/
# Remove empty deploy/
rmdir deploy/docker deploy/kubernetes deploy
```

Move `server/` into `deployments/`:

```bash
mv server/win32 deployments/server-win32/
mv server/windows deployments/server-windows/
rmdir server
```

**Verification**: No broken references in scripts or configs.

#### Step 1.4: Move Artifacts to SDK Workspace

Move `artifacts/openapi/` to `sdks/` or keep as build output:

```bash
# If artifacts are source OpenAPI specs, move to sdks/
mv artifacts/openapi sdks/openapi-specs/
rmdir artifacts
# If artifacts are build outputs, add to .gitignore
```

**Verification**: SDK generation scripts still work.

#### Step 1.5: Remove Root PC-Specific Packages

The root `packages/` directory currently has all 34 packages (13 shared + 21 PC-specific). The 21 PC-specific packages are duplicates of what's in `apps/sdkwork-birdcoder-pc/packages/`.

**IMPORTANT**: Before removing, verify that the root `pnpm-workspace.yaml` references `apps/sdkwork-birdcoder-pc/packages/*` directly, so the duplicates at root level are truly redundant.

Current root `pnpm-workspace.yaml` already references:
```yaml
- 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-*'
- 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*'
```

So the root `packages/sdkwork-birdcoder-pc-*` directories ARE duplicates. Remove them:

```bash
# Remove PC-specific packages from root (they exist in apps/sdkwork-birdcoder-pc/packages/)
rm -rf packages/sdkwork-birdcoder-pc-chat
rm -rf packages/sdkwork-birdcoder-pc-chat-claude
rm -rf packages/sdkwork-birdcoder-pc-chat-codex
rm -rf packages/sdkwork-birdcoder-pc-chat-gemini
rm -rf packages/sdkwork-birdcoder-pc-chat-opencode
rm -rf packages/sdkwork-birdcoder-pc-code
rm -rf packages/sdkwork-birdcoder-pc-codeengine
rm -rf packages/sdkwork-birdcoder-pc-desktop
rm -rf packages/sdkwork-birdcoder-pc-git
rm -rf packages/sdkwork-birdcoder-pc-host-core
rm -rf packages/sdkwork-birdcoder-pc-host-studio
rm -rf packages/sdkwork-birdcoder-pc-infrastructure-runtime
rm -rf packages/sdkwork-birdcoder-pc-multiwindow
rm -rf packages/sdkwork-birdcoder-pc-server
rm -rf packages/sdkwork-birdcoder-pc-shell-runtime
rm -rf packages/sdkwork-birdcoder-pc-studio
rm -rf packages/sdkwork-birdcoder-pc-ui
rm -rf packages/sdkwork-birdcoder-pc-ui-shell
rm -rf packages/sdkwork-birdcoder-pc-web
rm -rf packages/sdkwork-birdcoder-pc-workbench-state
rm -rf packages/sdkwork-birdcoder-pc-workbench-storage
```

**Verification**: `pnpm install` resolves correctly. `pnpm typecheck` from root and from `apps/sdkwork-birdcoder-pc/` both pass.

#### Step 1.6: Update Root pnpm-workspace.yaml

Update to reference shared packages at root and PC packages in app root:

```yaml
packages:
  # Shared cross-surface packages at repository root
  - 'packages/sdkwork-birdcoder-*'
  # PC app root packages
  - 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*'
  # PC app root SDKs
  - 'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript'
  - 'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript'
  # Cross-repository SDKWork sources (unchanged)
  - '../sdkwork-appbase/packages/common/iam/sdkwork-iam-contracts'
  # ... (all 18 cross-repo dependencies remain)
```

**NOTE**: The root `pnpm-workspace.yaml` currently includes both `packages/sdkwork-birdcoder-*` AND `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-*`. After removing root PC duplicates, the root pattern `packages/sdkwork-birdcoder-*` will only match the 13 shared packages. The PC-specific pattern `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*` picks up the 21 PC packages.

But wait - the root also has `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-*` which would match shared packages in the PC app root. The PC app root ALSO has copies of the 13 shared packages. This is the real duplication issue.

**Critical question**: Are the shared packages at root `packages/` and `apps/sdkwork-birdcoder-pc/packages/` identical? If so, we need to pick one location.

**Decision**: Keep shared packages ONLY at root `packages/`. Remove them from `apps/sdkwork-birdcoder-pc/packages/`. The PC app root's `pnpm-workspace.yaml` will reference root shared packages via relative path.

Updated root `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/sdkwork-birdcoder-*'
  - 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*'
  - 'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript'
  - 'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript'
  # ... cross-repo dependencies unchanged
```

Updated `apps/sdkwork-birdcoder-pc/pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/sdkwork-birdcoder-pc-*'
  - '../../packages/sdkwork-birdcoder-*'    # Reference root shared packages
  - 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript'
  - 'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript'
  # ... cross-repo dependencies with adjusted relative paths
```

**Verification**: Full `pnpm install && pnpm typecheck && pnpm lint` from root.

**Risk**: Medium - dependency resolution changes could break builds.
**Estimated effort**: 1-2 days

---

### Phase 2: Clean Up Root package.json Scripts

**Goal**: Separate shared scripts from PC-specific scripts.

#### Step 2.1: Classify Scripts

Move PC-specific scripts from root `package.json` to `apps/sdkwork-birdcoder-pc/package.json`:

**Keep at root** (shared workspace scripts):
- `dev`, `build`, `lint`, `typecheck` (delegate to active app)
- `check:arch`, `check:package-governance`, `check:dependency-management`
- `release:*` (shared release infrastructure)
- `generate:*` (shared SDK generation)
- `prepare:shared-sdk`
- `docs:*`

**Move to PC app root** (PC-specific):
- All `desktop:*` commands
- All `tauri:*` commands
- All `server:*` commands
- All `web:*` commands
- All `iam:*` commands (PC-specific IAM)
- All `check:desktop-*`, `check:tauri-*`, `check:server-*` commands
- All PC-specific test commands (`test:*` that reference PC packages)

#### Step 2.2: Update Root Scripts to Delegate

Root `package.json` scripts should delegate to app roots:

```json
{
  "scripts": {
    "dev": "pnpm --filter @sdkwork/birdcoder-pc dev",
    "dev:h5": "pnpm --filter @sdkwork/birdcoder-h5 dev",
    "dev:flutter": "pnpm --filter @sdkwork/birdcoder-flutter-mobile flutter:run",
    "build": "pnpm --filter @sdkwork/birdcoder-pc build",
    "build:h5": "pnpm --filter @sdkwork/birdcoder-h5 build",
    "typecheck": "pnpm run -r typecheck",
    "lint": "node scripts/run-quality-fast-check.mjs",
    "check:arch": "node scripts/check-arch-boundaries.mjs",
    "check:package-governance": "node scripts/package-governance-contract.test.mjs"
  }
}
```

**Risk**: Medium - script path changes.
**Estimated effort**: 1 day

---

### Phase 3: Create H5 App Root

**Goal**: Create `apps/sdkwork-birdcoder-h5/` following `APP_H5_ARCHITECTURE_SPEC.md`.

#### Step 3.1: Create Directory Structure

```bash
mkdir -p apps/sdkwork-birdcoder-h5/.sdkwork/skills
mkdir -p apps/sdkwork-birdcoder-h5/.sdkwork/plugins
mkdir -p apps/sdkwork-birdcoder-h5/bin/ios
mkdir -p apps/sdkwork-birdcoder-h5/bin/android
mkdir -p apps/sdkwork-birdcoder-h5/config/browser
mkdir -p apps/sdkwork-birdcoder-h5/config/host
mkdir -p apps/sdkwork-birdcoder-h5/config/server
mkdir -p apps/sdkwork-birdcoder-h5/config/container
mkdir -p apps/sdkwork-birdcoder-h5/docs
mkdir -p apps/sdkwork-birdcoder-h5/public
mkdir -p apps/sdkwork-birdcoder-h5/scripts
mkdir -p apps/sdkwork-birdcoder-h5/sdks
mkdir -p apps/sdkwork-birdcoder-h5/specs
mkdir -p apps/sdkwork-birdcoder-h5/src/bootstrap
mkdir -p apps/sdkwork-birdcoder-h5/src/providers
mkdir -p apps/sdkwork-birdcoder-h5/src/shell
mkdir -p apps/sdkwork-birdcoder-h5/src/routes
mkdir -p apps/sdkwork-birdcoder-h5/tests
```

#### Step 3.2: Create H5 Core Packages

Initial H5 packages (following `APP_H5_ARCHITECTURE_SPEC.md` §3):

```bash
# Core infrastructure packages
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-commons/src
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src

# App capability packages (initial)
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src

# Capacitor host package
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src/host
mkdir -p apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src/plugins
```

#### Step 3.3: Create H5 App Files

**`apps/sdkwork-birdcoder-h5/package.json`**:
```json
{
  "name": "@sdkwork/birdcoder-h5",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:prod": "tsc && vite build --mode production",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest",
    "cap:sync": "cap sync",
    "cap:ios:dev": "cap sync && cap open ios",
    "cap:android:dev": "cap sync && cap open android"
  }
}
```

**`apps/sdkwork-birdcoder-h5/pnpm-workspace.yaml`**:
```yaml
packages:
  - 'packages/sdkwork-birdcoder-h5-*'
  - '../../packages/sdkwork-birdcoder-*'
  - 'sdks/*'
  # Cross-repo dependencies (subset needed for H5)
  - '../../../sdkwork-appbase/packages/common/iam/sdkwork-iam-contracts'
  - '../../../sdkwork-appbase/packages/common/iam/sdkwork-iam-runtime'
  - '../../../sdkwork-appbase/packages/common/iam/sdkwork-iam-sdk-adapter'
  - '../../../sdkwork-appbase/packages/common/iam/sdkwork-iam-sdk-ports'
  - '../../../sdkwork-appbase/packages/common/iam/sdkwork-iam-service'
  - '../../../sdkwork-appbase/packages/common/foundation/sdkwork-runtime-bootstrap'
  - '../../../sdkwork-appbase/sdks/sdkwork-appbase-app-sdk/sdkwork-appbase-app-sdk-typescript/generated/server-openapi'
  - '../../../sdkwork-sdk-commons/sdkwork-sdk-common-typescript'
```

**`apps/sdkwork-birdcoder-h5/sdkwork.app.config.json`**:
```json
{
  "schemaVersion": 3,
  "kind": "sdkwork.app",
  "app": {
    "key": "sdkwork-birdcoder-h5",
    "name": "SDKWork Birdcoder H5",
    "appType": "APP_REACT",
    "identifiers": {
      "bundleId": "com.sdkwork.birdcoder.h5",
      "packageName": "com.sdkwork.birdcoder.h5"
    }
  },
  "runtime": {
    "family": "mobile",
    "framework": "react-capacitor",
    "runtimes": ["WEB", "CAPACITOR_IOS", "CAPACITOR_ANDROID"]
  }
}
```

**`apps/sdkwork-birdcoder-h5/src/main.tsx`**: Thin bootstrap entry.
**`apps/sdkwork-birdcoder-h5/src/App.tsx`**: App shell with providers.
**`apps/sdkwork-birdcoder-h5/src/AuthGate.tsx`**: Auth gate component.
**`apps/sdkwork-birdcoder-h5/src/bootstrap/environment.ts`**: Environment config.
**`apps/sdkwork-birdcoder-h5/src/bootstrap/runtime.ts`**: Runtime initialization.
**`apps/sdkwork-birdcoder-h5/src/bootstrap/sdkClients.ts`**: SDK client construction.
**`apps/sdkwork-birdcoder-h5/src/bootstrap/iamRuntime.ts`**: IAM runtime wiring.
**`apps/sdkwork-birdcoder-h5/src/bootstrap/routes.ts`**: Route assembly.

#### Step 3.4: Create H5 Config Templates

```bash
# Browser runtime config examples
cat > apps/sdkwork-birdcoder-h5/config/browser/runtime-env.development.example.json << 'EOF'
{
  "apiBaseUrl": "http://localhost:3000",
  "appVersion": "0.1.0"
}
EOF

# Capacitor host config examples
cat > apps/sdkwork-birdcoder-h5/config/host/capacitor.development.example.json << 'EOF'
{
  "iosBundleId": "com.sdkwork.birdcoder.h5",
  "androidPackageName": "com.sdkwork.birdcoder.h5"
}
EOF
```

#### Step 3.5: Create H5 AGENTS.md

```markdown
# SDKWork Birdcoder H5 Application
...
```

#### Step 3.6: Update Root pnpm-workspace.yaml

Add H5 app root packages:

```yaml
packages:
  - 'packages/sdkwork-birdcoder-*'
  - 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*'
  - 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-*'    # NEW
  # ... existing entries
```

**Verification**: `pnpm install` resolves. `pnpm --filter @sdkwork/birdcoder-h5 typecheck` passes.
**Risk**: Low (new code, no existing code affected)
**Estimated effort**: 2-3 days

---

### Phase 4: Create Flutter Mobile App Root

**Goal**: Create `apps/sdkwork-birdcoder-flutter-mobile/` following `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`.

#### Step 4.1: Create Directory Structure

```bash
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/.sdkwork/skills
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/.sdkwork/plugins
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/config/app
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/config/host
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/config/server
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/config/container
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/docs
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/scripts
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/sdks
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/specs
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/lib/bootstrap
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/lib/providers
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/lib/shell
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/lib/routes
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/test
```

#### Step 4.2: Create Flutter Core Packages

```bash
# Core infrastructure packages (snake_case per spec)
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_commons/lib/src
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_shell/lib/src

# App capability packages
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_chat/lib/src

# Host package
mkdir -p apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/lib/src
```

#### Step 4.3: Create Flutter App Files

**`apps/sdkwork-birdcoder-flutter-mobile/pubspec.yaml`**:
```yaml
name: sdkwork_birdcoder_flutter_mobile
description: SDKWork Birdcoder Flutter Mobile App
publish_to: 'none'
version: 0.1.0

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  sdkwork_birdcoder_flutter_mobile_core:
    path: packages/sdkwork_birdcoder_flutter_mobile_core
  sdkwork_birdcoder_flutter_mobile_shell:
    path: packages/sdkwork_birdcoder_flutter_mobile_shell

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
```

**`apps/sdkwork-birdcoder-flutter-mobile/lib/main.dart`**: Flutter app entry.
**`apps/sdkwork-birdcoder-flutter-mobile/lib/app.dart`**: MaterialApp with providers.
**`apps/sdkwork-birdcoder-flutter-mobile/lib/auth_gate.dart`**: Auth gate widget.
**`apps/sdkwork-birdcoder-flutter-mobile/lib/bootstrap/`**: Bootstrap files.

#### Step 4.4: Create Flutter Config Templates

```bash
cat > apps/sdkwork-birdcoder-flutter-mobile/config/app/runtime-env.development.example.json << 'EOF'
{
  "apiBaseUrl": "http://localhost:3000",
  "appVersion": "0.1.0"
}
EOF

cat > apps/sdkwork-birdcoder-flutter-mobile/config/host/flutter.development.example.json << 'EOF'
{
  "iosBundleId": "com.sdkwork.birdcoder.mobile",
  "androidPackageName": "com.sdkwork.birdcoder.mobile"
}
EOF
```

**Verification**: `flutter analyze` passes in Flutter app root.
**Risk**: Low (new code)
**Estimated effort**: 2-3 days

---

### Phase 5: Cross-App Route Alignment & SDK Sharing

**Goal**: Ensure route ids, SDK composition, and IAM runtime are aligned across all 3 app roots.

#### Step 5.1: Define Shared Route Ids

Create `specs/shared-routes.json` defining cross-surface route ids:

```json
{
  "routes": [
    {
      "id": "app.iam.login.index",
      "surface": "app",
      "domain": "iam",
      "capability": "login",
      "screen": "index",
      "titleKey": "route.login",
      "auth": "public"
    },
    {
      "id": "app.chat.index",
      "surface": "app",
      "domain": "chat",
      "capability": "chat",
      "screen": "index",
      "titleKey": "route.chat",
      "auth": "required"
    }
  ]
}
```

#### Step 5.2: Create Shared SDK Bootstrap Templates

Create shared SDK client construction patterns that each app root adapts:

```
packages/sdkwork-birdcoder-core/src/sdk/
  createAppSdkClients.ts        # Shared SDK factory pattern
  tokenManager.ts               # Shared TokenManager
  iamRuntime.ts                 # Shared IAM runtime
```

#### Step 5.3: Verify Cross-App Builds

```bash
# Build all app roots
pnpm --filter @sdkwork/birdcoder-pc build
pnpm --filter @sdkwork/birdcoder-h5 build
# Flutter: cd apps/sdkwork-birdcoder-flutter-mobile && flutter build apk --debug
```

**Risk**: Medium - cross-package dependency changes.
**Estimated effort**: 2-3 days

---

### Phase 6: Script Migration

**Goal**: Move PC-specific scripts from root to PC app root.

#### Step 6.1: Identify PC-Specific Scripts

Scripts that reference `packages/sdkwork-birdcoder-pc-*` or are PC-only test contracts:

```bash
# Find scripts referencing PC packages
grep -rl "sdkwork-birdcoder-pc-" scripts/ | wc -l
# Expected: ~400+ scripts
```

#### Step 6.2: Move PC Scripts

```bash
# Move PC-specific test contracts
mv scripts/*pc-*.test.* apps/sdkwork-birdcoder-pc/scripts/
mv scripts/*desktop-*.test.* apps/sdkwork-birdcoder-pc/scripts/
mv scripts/*tauri-*.test.* apps/sdkwork-birdcoder-pc/scripts/
mv scripts/*server-*.test.* apps/sdkwork-birdcoder-pc/scripts/
mv scripts/*multiwindow-*.test.* apps/sdkwork-birdcoder-pc/scripts/
```

#### Step 6.3: Update Script References

Update `apps/sdkwork-birdcoder-pc/package.json` to reference local scripts:

```json
{
  "scripts": {
    "check:desktop-tauri-dev": "node scripts/desktop-tauri-dev-contract.test.mjs",
    "check:multiwindow-standard": "node scripts/multiwindow-quality-gate-contract.test.mjs"
  }
}
```

**Risk**: Medium - many script path changes.
**Estimated effort**: 2-3 days

---

### Phase 7: Final Cleanup & Documentation

**Goal**: Ensure repository follows `SDKWORK_WORKSPACE_SPEC.md` completely.

#### Step 7.1: Populate Empty Directories

Add `README.md` to all required directories:

```bash
echo "# APIs" > apis/README.md
echo "# Crates" > crates/README.md
echo "# Jobs" > jobs/README.md
echo "# Tools" > tools/README.md
echo "# Plugins" > plugins/README.md
echo "# Examples" > examples/README.md
echo "# Tests" > tests/README.md
```

#### Step 7.2: Update Root AGENTS.md

Update to reflect multi-surface repository:

```markdown
# SDKWork Birdcoder Repository

## Application Surfaces
- PC: `apps/sdkwork-birdcoder-pc/` (APP_PC_ARCHITECTURE_SPEC.md)
- H5: `apps/sdkwork-birdcoder-h5/` (APP_H5_ARCHITECTURE_SPEC.md)
- Flutter: `apps/sdkwork-birdcoder-flutter-mobile/` (FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md)

## Shared Packages
- `packages/sdkwork-birdcoder-*` - Cross-surface shared packages
```

#### Step 7.3: Update Root README.md

Document the multi-surface architecture, build commands, and development workflow.

#### Step 7.4: Final Verification

```bash
# Full verification suite
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm check:arch
pnpm check:package-governance
pnpm build

# Per-app verification
pnpm --filter @sdkwork/birdcoder-pc typecheck
pnpm --filter @sdkwork/birdcoder-h5 typecheck
cd apps/sdkwork-birdcoder-flutter-mobile && flutter analyze
```

**Risk**: Low
**Estimated effort**: 1 day

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking PC app build | High | Phase 1 changes are incremental; verify after each step |
| pnpm dependency resolution failure | High | Test `pnpm install` after every workspace config change |
| Script path breakage | Medium | Use grep to find all references before moving scripts |
| Cross-repo dependency paths break | Medium | Adjust relative paths in per-app pnpm-workspace.yaml |
| Shared package version drift | Low | Use `workspace:*` protocol; root catalog governs versions |
| Rust workspace breakage | Low | Cargo.toml changes are minimal (just removing root duplicates) |

## Rollback Strategy

Each phase creates a git commit. If a phase fails verification:
1. `git revert` the phase commit
2. Investigate the failure
3. Fix and re-apply

## Estimated Total Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 0: Preparation | 1-2 hours | None |
| Phase 1: Clean Up Duplicates | 1-2 days | Phase 0 |
| Phase 2: Script Cleanup | 1 day | Phase 1 |
| Phase 3: H5 App Root | 2-3 days | Phase 1 |
| Phase 4: Flutter App Root | 2-3 days | Phase 1 |
| Phase 5: Cross-App Alignment | 2-3 days | Phase 3, 4 |
| Phase 6: Script Migration | 2-3 days | Phase 2 |
| Phase 7: Final Cleanup | 1 day | All phases |

**Total: ~10-15 days** (phases 3-4 can run in parallel with phase 2)

## Verification Checklist

- [ ] Root follows `SDKWORK_WORKSPACE_SPEC.md` directory dictionary
- [ ] Root has `AGENTS.md`, `.sdkwork/skills/`, `.sdkwork/plugins/`
- [ ] Each app root has `AGENTS.md`, `.sdkwork/skills/`, `.sdkwork/plugins/`
- [ ] Shared packages (13) exist only at root `packages/`
- [ ] PC packages (21) exist only in `apps/sdkwork-birdcoder-pc/packages/`
- [ ] H5 packages exist only in `apps/sdkwork-birdcoder-h5/packages/`
- [ ] Flutter packages exist only in `apps/sdkwork-birdcoder-flutter-mobile/packages/`
- [ ] Root `pnpm-workspace.yaml` references all app roots and shared packages
- [ ] Each app root `pnpm-workspace.yaml` references its own packages + root shared packages
- [ ] `pnpm install` resolves without errors
- [ ] `pnpm typecheck` passes from root and each app root
- [ ] `pnpm lint` passes
- [ ] `pnpm check:arch` passes
- [ ] `pnpm check:package-governance` passes
- [ ] PC app `pnpm build` produces working output
- [ ] H5 app `pnpm build` produces working output
- [ ] Flutter app `flutter analyze` passes
- [ ] Route ids align across PC and H5 for shared workflows
- [ ] SDK/IAM bootstrap follows `APP_SDK_INTEGRATION_SPEC.md` in each app root
- [ ] No raw HTTP, manual auth headers, or generated SDK edits in any app root
- [ ] Config templates are secret-free
- [ ] `configs/` and `deployments/` are the canonical project-root directories (no competing `config/` or `deploy/`)
