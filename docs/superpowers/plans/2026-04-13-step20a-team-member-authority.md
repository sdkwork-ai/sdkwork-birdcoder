# Step 20A Team Member Authority Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `team_member` from schema-only definition into real shared repository, route, facade, and first consumer authority without reopening already-closed team, policy, or deployment-record lanes.

**Architecture:** Keep the closure aligned with the existing Step 17 representative app or admin pattern. Add one admin-surface member-read lane rooted in the shared provider-backed table repository and shared generated client facade, then wire the in-process transport and Rust host to the same truth so every execution mode converges on one authority path.

**Tech Stack:** TypeScript, shared generated coding-server client, in-process app or admin transport, shared table repositories, Rust host Axum routes, contract tests, VitePress docs, release docs.

---

### Task 1: Freeze the Step 20A contract surface

**Files:**
- Modify: `packages/sdkwork-birdcoder-types/src/server-api.ts`
- Modify: `packages/sdkwork-birdcoder-server/src/index.ts`
- Test: `scripts/coding-server-route-contract.test.ts`
- Test: `scripts/generated-app-admin-client-facade-contract.test.ts`

- [ ] **Step 1: Write the failing route and facade tests**

Add assertions for one new admin route and one new shared facade entry:

```ts
assert.equal(admin.teamMembers.path, '/api/admin/v1/teams/:teamId/members');
const members = await client.listTeamMembers('team-generated-facade');
assert.equal(members[0]?.teamId, 'team-generated-facade');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
`node scripts/coding-server-route-contract.test.ts`
`node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`

Expected:
- route contract fails because `teamMembers` is missing
- generated facade contract fails because `listTeamMembers()` is missing

- [ ] **Step 3: Write the minimal contract implementation**

Update shared types and route contracts:

```ts
export interface BirdCoderAppAdminApiClient {
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
}

export interface BirdCoderAdminApiContract {
  teamMembers: BirdCoderApiRouteDefinition;
}
```

Add route registration and OpenAPI operation id:

```ts
teamMembers: createRoute(
  'admin',
  'admin',
  'GET',
  '/api/admin/v1/teams/:teamId/members',
  'List team members',
),
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
`node scripts/coding-server-route-contract.test.ts`
`node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`

Expected:
- both tests PASS

### Task 2: Close the shared repository and query lane

**Files:**
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts`
- Test: `scripts/provider-backed-console-contract.test.ts`

- [ ] **Step 1: Write the failing repository or query test**

Extend the provider-backed console contract to persist and read team members:

```ts
await repositories.members.save({
  id: 'member-console-contract',
  teamId: 'team-console-contract',
  identityId: 'identity-console-contract',
  role: 'admin',
  status: 'active',
  createdAt: '2026-04-13T10:00:00.000Z',
  updatedAt: '2026-04-13T10:00:00.000Z',
});

const members = await queries.listTeamMembers({ teamId: 'team-console-contract' });
assert.equal(members[0]?.id, 'member-console-contract');
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`node --experimental-strip-types scripts/provider-backed-console-contract.test.ts`

Expected:
- FAIL because the repository or query surface for members does not exist yet

- [ ] **Step 3: Write the minimal shared repository or query implementation**

Add:
- `BirdCoderRepresentativeTeamMemberRecord`
- `members` repository in `createBirdCoderRepresentativeAppAdminRepositories()`
- `listTeamMembers({ teamId })` query in `createBirdCoderAppAdminConsoleQueries()`

Keep scope minimal:

```ts
async listTeamMembers(options = {}): Promise<BirdCoderRepresentativeTeamMemberRecord[]> {
  const records = await repositories.members.list();
  return filterByTeamId(records, options.teamId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
`node --experimental-strip-types scripts/provider-backed-console-contract.test.ts`

Expected:
- PASS

### Task 3: Close the in-process transport and shared facade consumer

**Files:**
- Modify: `packages/sdkwork-birdcoder-types/src/server-api.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- Test: `scripts/generated-app-admin-client-facade-contract.test.ts`
- Test: `scripts/app-admin-sdk-consumer-contract.test.ts`

- [ ] **Step 1: Write the failing transport and consumer tests**

Add one generated-facade assertion and one in-process consumer assertion:

```ts
assert.deepEqual(observedRequests.at(-1), {
  method: 'GET',
  path: '/api/admin/v1/teams/team-generated-facade/members',
});
```

And:

```ts
const members = await client.listTeamMembers('team-sdk-contract');
assert.equal(members[0]?.role, 'admin');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
`node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
`node --experimental-strip-types scripts/app-admin-sdk-consumer-contract.test.ts`

Expected:
- FAIL because no transport mapping or facade method exists yet

- [ ] **Step 3: Write the minimal transport or facade implementation**

Add shared facade method:

```ts
async listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]> {
  const response = await client.request(...'admin.listTeamMembers'...);
  return response.items;
}
```

Add in-process route mapping:

```ts
case `/api/admin/v1/teams/${teamId}/members`:
  return createListEnvelope(
    (await queries.listTeamMembers({ teamId })).map(mapTeamMemberSummary),
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
`node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
`node --experimental-strip-types scripts/app-admin-sdk-consumer-contract.test.ts`

Expected:
- PASS

### Task 4: Close the Rust host route on the same authority path

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- Test: `scripts/coding-server-route-contract.test.ts`
- Test: targeted Rust route assertions already in `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing Rust-host route test**

Add route assertions for:
- route descriptor and operation id
- runtime response on demo authority
- runtime response on sqlite authority

Example assertion:

```rust
assert_eq!(admin_team_members_json["items"][0]["teamId"], "team-demo");
assert_eq!(admin_team_members_json["items"][0]["role"], "owner");
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
`cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
`cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`

Expected:
- FAIL because the member route and backing authority are missing

- [ ] **Step 3: Write the minimal Rust-host implementation**

Add:
- `TeamMemberPayload`
- provider table schema and clear-path support for `team_members`
- demo and sqlite authority loaders
- `GET /api/admin/v1/teams/:teamId/members`

- [ ] **Step 4: Run tests to verify they pass**

Run the same two cargo commands.

Expected:
- PASS

### Task 5: Backwrite docs and release after green verification

**Files:**
- Modify: `docs/step/20-runtime-data-kernel-v2剩余实体Authority闭环.md`
- Modify: `docs/prompts/反复执行Step指令.md`
- Modify: `docs/架构/07-数据模型-状态模型-接口契约.md`
- Modify: `docs/架构/18-多数据库抽象-Provider-迁移标准.md`
- Create: `docs/release/release-2026-04-13-07.md`
- Modify: `docs/release/releases.json`

- [ ] **Step 1: Write the failing docs or release expectation**

Use the implementation facts to decide the exact closure language:
- Step 20A closed
- Step 20B still next
- do not claim deployment-target closure yet

- [ ] **Step 2: Run docs and governance checks before writing the final note**

Run:
`node scripts/live-docs-governance-baseline.test.mjs`
`node scripts/release-flow-contract.test.mjs`

Expected:
- PASS before final release writeback, proving no unrelated docs drift

- [ ] **Step 3: Write the minimal docs and release updates**

Capture:
- closure facts
- exact files changed
- exact verification commands
- next serial goal = `deployment_target`

- [ ] **Step 4: Run full Step 20A verification**

Run:
`node scripts/coding-server-route-contract.test.ts`
`node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
`node --experimental-strip-types scripts/app-admin-sdk-consumer-contract.test.ts`
`node --experimental-strip-types scripts/provider-backed-console-contract.test.ts`
`cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
`cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
`pnpm.cmd run docs:build`
`node scripts/live-docs-governance-baseline.test.mjs`
`node scripts/release-flow-contract.test.mjs`

Expected:
- all PASS
