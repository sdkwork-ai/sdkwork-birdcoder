> Migrated from `docs/release/release-2026-04-10-29.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Adds the shared `sqlPlans.ts` planner layer so BirdCoder now has one dialect-aware SQL plan contract for `sqlite/postgresql` across schema migrations, migration history writes, table reads, and table mutations.
- Introduces an executable `sql-storage-plan` contract test and promotes it into the `test:storage-provider-contract` and `check:data-kernel` verification chains.
- Rewrites Step 17 architecture, execution prompt, and release guidance so the next serial closure is accurately defined as binding the shared SQL plans to real executors, not re-designing provider/UoW again.

## Scope

- [sqlPlans.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts)
- [sql-storage-plan-contract.test.ts](/<workspace-root>/sdkwork-birdcoder/scripts/sql-storage-plan-contract.test.ts)
- [package.json](/<workspace-root>/sdkwork-birdcoder/package.json)
- [17-Coding-Server-App-Backend-SDK与控制台实现.md](/<workspace-root>/sdkwork-birdcoder/docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md)
- [20-统一Rust-Coding-Server-API-协议标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md)
- [反复执行Step指令.md](/<workspace-root>/sdkwork-birdcoder/docs/prompts/反复执行Step指令.md)

## Verification

- `pnpm.cmd run test:sql-storage-plan-contract`
- `pnpm.cmd run test:storage-provider-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run check:data-kernel`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:server`

## Notes

- The new planner layer is intentionally shared-contract-first: it closes SQL statement generation without claiming that the repo has already switched to real SQLite/PostgreSQL execution.
- The next serial step is executor binding plus representative repository adoption on the same row/plan contract, which keeps the provider/UoW boundary stable while removing the remaining local-store-backed execution gap.

