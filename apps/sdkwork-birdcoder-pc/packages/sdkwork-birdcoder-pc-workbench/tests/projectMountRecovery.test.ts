import { describe, expect, it } from 'vitest';

import {
  createProjectMountRecoveryStateFromDeviceMount,
  isProjectMountReadyForSessionSynchronization,
  resolveProjectMountRecoveryActions,
} from '../src/workbench/projectMountRecovery.ts';

describe('project mount recovery', () => {
  it('surfaces every state that requires user attention', () => {
    expect(resolveProjectMountRecoveryActions('mount_required')).toEqual({
      chooseFolder: true,
      requiresAttention: true,
      retry: false,
    });
    expect(resolveProjectMountRecoveryActions('permission_required')).toEqual({
      chooseFolder: true,
      requiresAttention: true,
      retry: false,
    });
    expect(resolveProjectMountRecoveryActions('session_required')).toEqual({
      chooseFolder: false,
      requiresAttention: true,
      retry: false,
    });
    expect(resolveProjectMountRecoveryActions('failed')).toEqual({
      chooseFolder: true,
      requiresAttention: true,
      retry: true,
    });
  });

  it('keeps idle and healthy mounts out of the recovery banner', () => {
    for (const status of ['idle', 'recovering', 'recovered'] as const) {
      expect(resolveProjectMountRecoveryActions(status).requiresAttention).toBe(false);
    }
  });

  it('explains that a missing mount blocks local coding sessions', () => {
    const recovery = createProjectMountRecoveryStateFromDeviceMount({
      displayName: null,
      host: null,
      status: 'mount_required',
    });

    expect(recovery).toMatchObject({
      status: 'mount_required',
    });
    expect(recovery.message).toContain('local coding sessions');
  });

  it('uses mount authority instead of file count to decide whether sessions can synchronize', () => {
    expect(isProjectMountReadyForSessionSynchronization({
      displayName: 'empty-project',
      host: 'tauri',
      status: 'mounted',
    })).toBe(true);
    expect(isProjectMountReadyForSessionSynchronization({
      displayName: 'empty-project',
      host: 'tauri',
      status: 'mount_required',
    })).toBe(false);
  });
});
