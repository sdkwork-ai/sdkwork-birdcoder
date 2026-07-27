import { describe, expect, it, vi } from 'vitest';

import {
  fingerprintBrowserDirectoryHandle,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/ProjectDeviceMountRegistry';
import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';

function directoryHandle(
  entries: Array<[string, 'directory' | 'file']>,
): FileSystemDirectoryHandle {
  return {
    async *entries() {
      for (const [name, kind] of entries) {
        yield [name, { kind, name } as FileSystemHandle] as [string, FileSystemHandle];
      }
    },
    kind: 'directory',
    name: 'BirdCoder',
  } as FileSystemDirectoryHandle;
}

describe('browser native directory identity', () => {
  it('matches the Rust directory manifest fingerprint contract', async () => {
    const fingerprint = await fingerprintBrowserDirectoryHandle(directoryHandle([
      ['src', 'directory'],
      ['README.md', 'file'],
    ]));

    expect(fingerprint).toBe(
      'sha256:f611049ecf939c2f4f384785cd0de25f5d472a042f87e64aced215c939aabe29',
    );
  });

  it('adds the directory identity only to the first project session page', async () => {
    const list = vi.fn(async (
      _projectId: string,
      _params?: Record<string, unknown>,
    ) => ({
      items: [],
      pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 20 },
    }));
    const identityProvider = vi.fn(async () => ({
      directoryFingerprint:
        'sha256:f611049ecf939c2f4f384785cd0de25f5d472a042f87e64aced215c939aabe29',
      directoryName: 'BirdCoder',
    }));
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { projectSessions: { list } } },
      } as never,
      nativeDirectoryIdentityProvider: identityProvider,
    });

    await service.listSessionsByProject({ page: 1, projectId: 'project.test' });
    await service.listSessionsByProject({ page: 2, projectId: 'project.test' });

    expect(identityProvider).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[1]).toMatchObject({
      nativeDirectoryFingerprint:
        'sha256:f611049ecf939c2f4f384785cd0de25f5d472a042f87e64aced215c939aabe29',
      nativeDirectoryName: 'BirdCoder',
      page: 1,
    });
    expect(list.mock.calls[1]?.[1]).toMatchObject({ page: 2 });
    expect(list.mock.calls[1]?.[1]).not.toHaveProperty('nativeDirectoryFingerprint');
  });
});
