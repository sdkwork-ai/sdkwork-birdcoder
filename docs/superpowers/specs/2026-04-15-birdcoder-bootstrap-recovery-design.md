# BirdCoder Bootstrap And Recovery Design

## Goal

Make BirdCoder start in a non-empty, immediately usable state across desktop, web, and embedded-server modes, and recover quickly after abnormal termination without violating safety boundaries.

## Problem

- Desktop currently bootstraps only a default workspace in Tauri-local SQLite.
- API-backed startup does not guarantee a non-empty user context.
- The UI still carries hardcoded startup assumptions such as `ws-1`.
- Recovery data exists for coding sessions and terminal sessions, but there is no unified startup recovery policy.

## Options Considered

### Option A: Patch each host separately

- Keep adding workspace or project fallbacks in desktop, web hooks, and page state.
- This is fast but guarantees drift between hosts and turns startup into a permanent bug source.

### Option B: Seed full demo data

- Pre-create broad product data so first launch always looks full.
- This improves first-launch appearance but pollutes real environments and is not acceptable for commercial production behavior.

### Option C: Unified bootstrap plus safe recovery

- Move minimum required bootstrap into the authority startup path.
- Keep bootstrap minimal and real: workspace, starter project, runtime defaults, recovery context.
- Restore the last valid context from persisted recovery state and session inventory, but never auto-run dangerous terminal commands.

## Chosen Design

Use Option C.

## Architecture

### 1. System Bootstrap

- Runs whenever the Rust authority loads a SQLite provider.
- Ensures provider tables exist and then ensures a minimum usable app context exists.
- This bootstrap is idempotent and transaction-safe.

### 2. User Bootstrap Kit

Phase 1 implementation will persist or guarantee:

- default workspace
- starter project bound to that workspace
- deterministic default ids for first-run local mode

Phase 2 can extend bootstrap to cover:

- user profile
- workbench preferences
- run configurations
- onboarding state

### 3. Recovery Kit

Phase 1 implementation will persist and consume:

- last active workspace id
- last active project id
- last active tab
- clean-exit marker
- session inventory fallback from persisted coding and terminal sessions

Phase 1 recovery rules:

- Prefer the saved workspace and project when they still exist.
- If the saved context is missing, fall back to the most recent persisted session inventory.
- If no valid recovery data exists, fall back to the bootstrapped starter workspace and project.
- Restore terminal metadata only. Never auto-execute commands on recovery.

## Data Policy

### Default-create

- workspace
- project
- recovery snapshot

### Lazy-create only

- team
- team member
- document
- deployment target
- deployment record
- release record
- coding session
- terminal session
- audit event

### Never default-create

- fake demo business data
- fake team structures
- fake release or deployment history

## Runtime Behavior

### Authority startup

- SQLite authority load must end with at least one workspace and one project.
- If there are workspaces but no projects, create one starter project under the most recent workspace.
- Existing user-created data must never be overwritten.

### App startup

- Remove hardcoded startup ids from the app shell.
- Resolve workspace and project from recovery snapshot plus session inventory.
- Persist updated recovery state as the user changes workspace, project, and tab.
- Mark the session as unclean during active runtime and clean on graceful exit.

## Safety Rules

- Recovery must not auto-run terminal commands.
- Recovery must not auto-remount protected filesystem locations.
- Recovery must not invent missing business records other than the minimum startup workspace and project.

## Testing Strategy

- Rust host contract: empty provider authority bootstraps a default workspace and starter project.
- Rust host contract: existing workspace with no projects gets exactly one starter project and keeps the existing workspace.
- TypeScript contract: startup recovery prefers persisted valid context, falls back to session inventory, then falls back to first available workspace or project.
- App contract: root app startup no longer hardcodes `ws-1` and uses recovery-driven selection.

## Out Of Scope

- Full server-backed persistence for all preference and onboarding entities.
- Automatic resume of running engine processes.
- Automatic restoration of filesystem grants.
