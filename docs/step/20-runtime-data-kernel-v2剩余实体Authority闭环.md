# Step 20 - runtime-data-kernel-v2 剩余实体 Authority 闭环

## Status

- Defined on `2026-04-13`.
- `20A team_member` implemented and verified on `2026-04-13`.
- `20B deployment_target` implemented and verified on `2026-04-13`.
- Step `20` is now fully closed.

## Goal

Close the remaining `runtime-data-kernel-v2` schema-only entities by promoting `team_member` and `deployment_target` from shared type or migration definitions into real shared repository, route, facade, and consumer authority without reopening the already-closed `team`, `project_document`, `deployment_record`, `release_record`, or policy lanes.

## Current Evidence

- `packages/sdkwork-birdcoder-types/src/data.ts` already defines:
  - `team_member -> team_members`
  - `deployment_target -> deployment_targets`
- `packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts` already includes both entities in the provider-side `coding-server-kernel-v2` entity set.
- `packages/sdkwork-birdcoder-types/src/server-api.ts` already freezes:
  - `BirdCoderTeamMemberSummary`
  - `BirdCoderDeploymentTargetSummary`
  - `BirdCoderAdminApiModel.members`
  - `BirdCoderAdminApiModel.deploymentTargets`
- `team_member` is now closed on a real shared authority path:
  - shared console repositories and queries now materialize `team_members`
  - the shared generated facade now exposes `listTeamMembers(teamId)` on `/api/admin/v1/teams/:teamId/members`
  - the in-process transport and Rust host demo/sqlite authorities now serve the same admin member route
- `deployment_target` is now also closed on a real shared authority path:
  - shared console repositories and queries now materialize `deployment_targets`
  - the shared generated facade now exposes `listDeploymentTargets(projectId)` on `/api/admin/v1/projects/:projectId/deployment-targets`
  - the in-process transport and Rust host demo/sqlite authorities now serve the same project-scoped admin target route
- Step `17Z` explicitly avoided forcing `deployment_target` into the earlier deployment-record lane, so the Step `20B` closure is a deliberate new authority slice, not a regression in an already-closed deployment-record path.
- Step `20` no longer has an open schema-only authority entity in `runtime-data-kernel-v2`.

## Scope

- `packages/sdkwork-birdcoder-types/src/data.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts`
- shared collaboration or delivery repository and query layers
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- shared generated facade promotion and first consumer adoption
- governance contracts, architecture writeback, prompt writeback, and release notes

## Non-Goals

- Do not reopen `team`, `project_document`, `deployment_record`, `release_record`, `audit_event`, or `governance_policy` closures unless fresh failing evidence appears.
- Do not invent page-local mock state or sidecar-only truth for either entity.
- Do not use Step `20` closure work as a reason to expand Terminal, engine onboarding, or Prompt or Template scope.

## Minimal Output

- one frozen authority contract for `team_member`
- one frozen authority contract for `deployment_target`
- provider-backed repository or query closure for both entities on the shared UoW boundary
- real `coding-server` route truth for the promoted surfaces
- shared generated-facade methods plus first representative consumers
- release-flow and docs writeback that records both lanes as closed on the same authority truth
- final Step closure evidence that records both lanes as closed and unlocks the next undefined Step

## Serial Path

1. Freeze the promoted route and DTO contract for `team_member` and `deployment_target` on the shared types and `coding-server` contract boundary.
2. Close provider-backed repository and query truth so both entities stop living at schema-definition level only.
3. Promote real Rust host reads on top of the same authority path instead of placeholder or omitted surfaces.
4. Promote shared app or admin facade methods and wire the first representative consumers.
5. Backwrite architecture, Step, prompt, and release evidence so future loops see the new closure truth directly.

## Recommended Lane Order

1. `20A` completed lane: `team_member`
2. `20B` completed lane: `deployment_target`

Reasoning:

- `team_member` was the shorter serial slice because it extended the already-real `team` collaboration authority without reopening deployment-surface routing choices.
- `deployment_target` required clarifying how target catalogs surface beside the already-closed deployment-record and policy-governance lanes, and it is now closed as the second serial slice after `20A`.

## Checkpoints

- `CP20-1` `team_member` and `deployment_target` must stop being schema-only entities; at least one real authority path must be frozen before consumer work starts.
- `CP20-2` repository and query truth must stay on shared provider or UoW boundaries, not page-local state.
- `CP20-3` shared generated facades must own the promoted reads once the server route truth is real.
- `CP20-4` one representative consumer per promoted surface must adopt the shared facade instead of rebuilding transport details locally.
- `CP20-5` docs and release notes must state when neither `team_member` nor `deployment_target` remains open so Step `20` can be marked complete.

## Verification Plan

- targeted repository contracts for `team_member` and `deployment_target`
- targeted Rust host route contracts for the promoted member or deployment-target surfaces
- shared app or admin generated-facade contracts
- first consumer adoption contracts
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Unlock Conditions

- `team_member` closure unlocked `deployment_target`
- `deployment_target` closure now unlocks the next not-yet-defined Step beyond the former `runtime-data-kernel-v2` authority gap
- future loops must not reopen Step `20` unless fresh failing evidence appears on the already-closed member or deployment-target lanes

## Notes

- This Step is now historical closure evidence for the former serial authority gap; future loops should not keep treating it as the active next Step.
- The current loop has now closed both `20A team_member` and `20B deployment_target`.
- The next autonomous loop should select a new lowest-score Step from fresh code/test/docs evidence instead of continuing to expand Step `20`.
