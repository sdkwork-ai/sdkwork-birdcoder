import { describe, expect, it } from 'vitest';
import { resolveLifecycleEventLabel } from './lifecycleEventPresentation.ts';

describe('lifecycle event presentation', () => {
  it('distinguishes automatic and explicit context compaction', () => {
    expect(resolveLifecycleEventLabel({
      automatic: true,
      id: 'automatic-compaction',
      kind: 'compacted',
    })).toBe('Context automatically compacted');
    expect(resolveLifecycleEventLabel({
      automatic: false,
      id: 'manual-compaction',
      kind: 'compacted',
    })).toBe('Context compacted');
  });
});
