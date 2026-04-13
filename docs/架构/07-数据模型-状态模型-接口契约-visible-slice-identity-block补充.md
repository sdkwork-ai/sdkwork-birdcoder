# 07 Contract Addendum - Visible Slice Identity Block

## 1. Goal

- Align the Step 07 visible-slice markdown family on one shared top-level identity block.
- Keep the change inside `viewer.ts` without widening UI, storage, or release schemas.
- Reduce drift between issue-template, summary, and release-note outputs.

## 2. Contract

- Shared fields: `Evidence Keys`, `Titles`
- Scope: visible-slice issue template, visible-slice summary template, visible-slice release-note template
- Ordering rule: preserve the current visible slice order
- Output rule: identity fields stay in top-level summary/scope/notes sections instead of existing only inside detailed entry blocks

## 3. Evaluation

- Pass if all visible-slice markdown builders expose the same top-level identity fields.
- Fail if any output drops evidence identities, changes ordering, or hides titles only in deep entry sections.
