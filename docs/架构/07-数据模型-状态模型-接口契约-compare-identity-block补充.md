# 07 Contract Addendum - Compare Identity Block

## 1. Goal

- Align the Step 07 compare-output family on one shared identity block.
- Keep the change inside `viewer.ts` without widening UI, storage, or release schemas.
- Reduce compare-template drift across markdown triage outputs.

## 2. Contract

- Shared lines: `Evidence A`, `Evidence B`, `Entry A Title`, `Entry B Title`, `Entry A Project`, `Entry B Project`, `Entry A Run Config`, `Entry B Run Config`, `Entry A Profile`, `Entry B Profile`, `Entry A Lane`, `Entry B Lane`
- Scope: compare template, compare issue template, compare summary template, compare release-note template
- Ordering rule: preserve the selected pair order from the current visible slice
- Output rule: identity lines stay in the top-level summary or scope block, not buried only inside detailed entry sections or repeated in deeper notes blocks

## 3. Evaluation

- Pass if all compare markdown builders expose the same pair identity block before detailed sections.
- Fail if any compare output drops one side of the pair, changes ordering, loses title/project/run-config/profile/lane context, or hides/repeats identity only in deep entry details.
