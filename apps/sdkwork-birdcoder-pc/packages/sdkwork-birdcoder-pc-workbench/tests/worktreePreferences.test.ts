import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORKTREE_LIST_LIMIT,
  MAX_WORKTREE_LIST_LIMIT,
  MIN_WORKTREE_LIST_LIMIT,
  normalizeWorkbenchPreferences,
  normalizeWorkbenchWorktreeListLimit,
} from '../src/workbench/preferences.ts';

describe('worktree preferences', () => {
  it('uses safe defaults for missing or invalid values', () => {
    expect(normalizeWorkbenchPreferences(undefined)).toMatchObject({
      worktreeAutoPrune: true,
      worktreeListLimit: DEFAULT_WORKTREE_LIST_LIMIT,
    });
    expect(normalizeWorkbenchPreferences({
      worktreeListLimit: Number.NaN,
    })).toMatchObject({
      worktreeAutoPrune: true,
      worktreeListLimit: DEFAULT_WORKTREE_LIST_LIMIT,
    });
  });

  it('persists the automatic prune choice and clamps the list limit', () => {
    expect(normalizeWorkbenchPreferences({
      worktreeAutoPrune: false,
      worktreeListLimit: 24.4,
    })).toMatchObject({
      worktreeAutoPrune: false,
      worktreeListLimit: 24,
    });
    expect(normalizeWorkbenchWorktreeListLimit(0)).toBe(MIN_WORKTREE_LIST_LIMIT);
    expect(normalizeWorkbenchWorktreeListLimit(1_000)).toBe(MAX_WORKTREE_LIST_LIMIT);
  });
});
