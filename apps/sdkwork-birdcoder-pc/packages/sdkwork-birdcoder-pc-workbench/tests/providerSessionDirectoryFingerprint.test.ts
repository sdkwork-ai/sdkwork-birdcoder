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
  } as unknown as FileSystemDirectoryHandle;
}

describe('browser provider Session directory identity', () => {
  it('matches the Rust directory manifest fingerprint contract', async () => {
    const fingerprint = await fingerprintBrowserDirectoryHandle(directoryHandle([
      ['src', 'directory'],
      ['README.md', 'file'],
    ]));

    expect(fingerprint).toBe(
      'sha256:501fa61985d3b2c255fdb3816cfa1f20953812554fbeb8dd07c2b18b89388913',
    );
  });

  it('never sends local directory identity while listing project sessions', async () => {
    const list = vi.fn(async (
      _projectId: string,
      _params?: Record<string, unknown>,
    ) => ({
      items: [],
      pageInfo: { hasMore: false, mode: 'offset', page: 1, pageSize: 20 },
    }));
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { projectSessions: { list } } },
      } as never,
    });

    await service.listSessionsByProject({ page: 1, projectId: 'project.test' });
    await service.listSessionsByProject({ page: 2, projectId: 'project.test' });

    expect(list.mock.calls[0]?.[1]).toMatchObject({ page: 1 });
    expect(list.mock.calls[0]?.[1]).not.toHaveProperty('providerSessionDirectoryFingerprint');
    expect(list.mock.calls[0]?.[1]).not.toHaveProperty('providerSessionDirectoryName');
    expect(list.mock.calls[1]?.[1]).toMatchObject({ page: 2 });
    expect(list.mock.calls[1]?.[1]).not.toHaveProperty('providerSessionDirectoryFingerprint');
    expect(list.mock.calls[1]?.[1]).not.toHaveProperty('providerSessionDirectoryName');
  });
});
