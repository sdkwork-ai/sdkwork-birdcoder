import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GIT_BRANCH_PREFIX,
  MAX_GIT_BRANCH_PREFIX_LENGTH,
  MAX_GIT_INSTRUCTIONS_LENGTH,
  normalizeWorkbenchPreferences,
} from '../src/workbench/preferences.ts';

describe('Git preferences', () => {
  it('uses the Codex-compatible workflow defaults', () => {
    expect(normalizeWorkbenchPreferences(undefined)).toMatchObject({
      gitBranchPrefix: DEFAULT_GIT_BRANCH_PREFIX,
      gitCommitInstructions: '',
      gitCreateDraftPullRequest: true,
      gitForceWithLease: false,
      gitPullRequestInstructions: '',
      gitPullRequestMergeMethod: 'merge',
      gitReviewDeliveryMode: 'inline',
    });
  });

  it('normalizes enums and preserves explicit workflow choices', () => {
    expect(normalizeWorkbenchPreferences({
      gitBranchPrefix: ' feature/ ',
      gitCommitInstructions: 'Use an imperative subject.',
      gitCreateDraftPullRequest: false,
      gitForceWithLease: true,
      gitPullRequestInstructions: 'Summarize verification.',
      gitPullRequestMergeMethod: 'SQUASH',
      gitReviewDeliveryMode: 'SEPARATE',
    })).toMatchObject({
      gitBranchPrefix: 'feature/',
      gitCommitInstructions: 'Use an imperative subject.',
      gitCreateDraftPullRequest: false,
      gitForceWithLease: true,
      gitPullRequestInstructions: 'Summarize verification.',
      gitPullRequestMergeMethod: 'squash',
      gitReviewDeliveryMode: 'separate',
    });
  });

  it('bounds user-authored Git preference text', () => {
    const normalized = normalizeWorkbenchPreferences({
      gitBranchPrefix: 'a'.repeat(MAX_GIT_BRANCH_PREFIX_LENGTH + 5),
      gitCommitInstructions: 'b'.repeat(MAX_GIT_INSTRUCTIONS_LENGTH + 5),
      gitPullRequestInstructions: 'c'.repeat(MAX_GIT_INSTRUCTIONS_LENGTH + 5),
      gitPullRequestMergeMethod: 'rebase',
      gitReviewDeliveryMode: 'unknown',
    });

    expect(normalized.gitBranchPrefix).toHaveLength(MAX_GIT_BRANCH_PREFIX_LENGTH);
    expect(normalized.gitCommitInstructions).toHaveLength(MAX_GIT_INSTRUCTIONS_LENGTH);
    expect(normalized.gitPullRequestInstructions).toHaveLength(MAX_GIT_INSTRUCTIONS_LENGTH);
    expect(normalized.gitPullRequestMergeMethod).toBe('merge');
    expect(normalized.gitReviewDeliveryMode).toBe('inline');
  });
});
