import { describe, expect, it, vi } from 'vitest';

import {
  createProjectSessionSynchronizationCoordinator,
  type ProjectSessionSynchronizationScope,
} from '../src/workbench/projectSessionSynchronization.ts';

const scope: ProjectSessionSynchronizationScope = {
  projectId: 'project-1',
  userScope: 'user-1::session:1',
  workspaceId: 'workspace-1',
};

describe('project session synchronization coordinator', () => {
  it('deduplicates concurrent work and caches only a successful result', async () => {
    let resolveTask: ((value: { sessionCount: number }) => void) | undefined;
    const task = vi.fn(() => new Promise<{ sessionCount: number }>((resolve) => {
      resolveTask = resolve;
    }));
    const coordinator = createProjectSessionSynchronizationCoordinator<{
      sessionCount: number;
    }>();

    const first = coordinator.synchronize(scope, task);
    const second = coordinator.synchronize(scope, task);
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    resolveTask?.({ sessionCount: 489 });
    await expect(first).resolves.toEqual({ sessionCount: 489 });
    await expect(second).resolves.toEqual({ sessionCount: 489 });
    await expect(coordinator.synchronize(scope, task)).resolves.toBeNull();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('allows retry after failure or an unavailable result', async () => {
    const coordinator = createProjectSessionSynchronizationCoordinator<{ sessionCount: number }>();
    const failedTask = vi.fn(async () => {
      throw new Error('temporary synchronization failure');
    });
    const unavailableTask = vi.fn(async () => null);
    const successfulTask = vi.fn(async () => ({ sessionCount: 20 }));

    await expect(coordinator.synchronize(scope, failedTask)).rejects.toThrow(
      'temporary synchronization failure',
    );
    await expect(coordinator.synchronize(scope, unavailableTask)).resolves.toBeNull();
    await expect(coordinator.synchronize(scope, successfulTask)).resolves.toEqual({
      sessionCount: 20,
    });
    expect(failedTask).toHaveBeenCalledTimes(1);
    expect(unavailableTask).toHaveBeenCalledTimes(1);
    expect(successfulTask).toHaveBeenCalledTimes(1);
  });

  it('supports explicit refreshes and invalidation after a mount changes', async () => {
    const coordinator = createProjectSessionSynchronizationCoordinator<number>();
    const task = vi.fn(async () => 1);

    await coordinator.synchronize(scope, task);
    await coordinator.synchronize(scope, task, { force: true });
    coordinator.invalidate(scope);
    await coordinator.synchronize(scope, task);

    expect(task).toHaveBeenCalledTimes(3);
  });

  it('aborts and suppresses a stale task when a forced refresh starts', async () => {
    const coordinator = createProjectSessionSynchronizationCoordinator<number>();
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((value: number) => void) | undefined;
    const first = coordinator.synchronize(scope, ({ signal }) => {
      firstSignal = signal;
      return new Promise<number>((resolve) => {
        resolveFirst = resolve;
      });
    });
    await Promise.resolve();

    const second = coordinator.synchronize(scope, async ({ signal }) => {
      expect(signal.aborted).toBe(false);
      return 2;
    }, { force: true });
    resolveFirst?.(1);

    expect(firstSignal?.aborted).toBe(true);
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBe(2);
  });

  it('expires successful cache entries after the configured TTL', async () => {
    vi.useFakeTimers();
    try {
      const coordinator = createProjectSessionSynchronizationCoordinator<number>();
      const task = vi.fn(async () => 1);
      await coordinator.synchronize(scope, task, { cacheTtlMs: 1_000 });
      await coordinator.synchronize(scope, task, { cacheTtlMs: 1_000 });
      expect(task).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_001);
      await coordinator.synchronize(scope, task, { cacheTtlMs: 1_000 });
      expect(task).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
