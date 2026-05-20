# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly before implementing.
- If uncertain, ask rather than guess.
- Present multiple interpretations instead of silently picking one.
- Suggest simpler approaches when they exist; push back when warranted.
- If something is unclear, stop and ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No unrequested flexibility or configurability.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.
- Self-check: "Would a senior engineer say this is overcomplicated?" — if yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- If you notice unrelated dead code, mention it but don't delete it.
- Remove imports/variables/functions that YOUR changes made unused — but don't touch pre-existing dead code unless asked.
- Test: "Every changed line should trace directly to the user's request."

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

- Transform tasks into verifiable goals:
  - "Add validation" → write tests for invalid inputs, then make them pass.
  - "Fix the bug" → write a reproducing test, then make it pass.
  - "Refactor X" → ensure tests pass before and after.
- For multi-step tasks, state a plan with step → verify: [check] for each.
- Strong success criteria let you loop independently; weak criteria ("make it work") require constant clarification.

---

These guidelines are working when: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
