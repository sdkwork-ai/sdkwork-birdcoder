import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ApiBackedAppRuntimeReadService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts';
import type {
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionSummary,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';

const nativeSummary: BirdCoderNativeSessionSummary = {
  id: 'codex-native:thread-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: 'Codex thread',
  status: 'active',
  runtimeStatus: 'ready',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5',
  nativeSessionId: 'thread-1',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:01:00.000Z',
  lastTurnAt: '2026-07-15T00:01:00.000Z',
  transcriptUpdatedAt: '2026-07-15T00:01:00.000Z',
  sortTimestamp: '1752537660000',
  kind: 'coding',
  nativeCwd: 'E:/workspace/project-1',
};
const nativeDetail: BirdCoderNativeSessionDetail = {
  summary: nativeSummary,
  messages: [],
};
const nativePage = {
  items: [nativeSummary],
  pageInfo: {
    hasMore: false,
    mode: 'offset' as const,
    page: 1,
    pageSize: 20,
    totalItems: '1',
    totalPages: 1,
  },
};

let remoteListCalls = 0;
let remoteGetCalls = 0;
const remoteClient = {
  async getNativeSession() {
    remoteGetCalls += 1;
    return nativeDetail;
  },
  async listNativeSessions() {
    remoteListCalls += 1;
    return [nativeSummary];
  },
  async listNativeSessionPage() {
    remoteListCalls += 1;
    return nativePage;
  },
} as never;

let localListCalls = 0;
let localGetCalls = 0;
const localService = new ApiBackedAppRuntimeReadService({
  client: remoteClient,
  nativeSessionReadPort: {
    async getNativeSession() {
      localGetCalls += 1;
      return nativeDetail;
    },
    async listNativeSessionPage() {
      localListCalls += 1;
      return nativePage;
    },
  },
});

const request = { projectId: 'project-1', workspaceId: 'workspace-1' };
assert.deepEqual(await localService.listNativeSessions(request), [nativeSummary]);
assert.deepEqual(await localService.listNativeSessionPage(request), nativePage);
assert.deepEqual(await localService.getNativeSession(nativeSummary.id, request), nativeDetail);
assert.equal(localListCalls, 2);
assert.equal(localGetCalls, 1);
assert.equal(remoteListCalls, 0, 'a mounted native provider must own native thread listing');
assert.equal(remoteGetCalls, 0, 'a mounted native provider must own native thread detail');

const fallbackService = new ApiBackedAppRuntimeReadService({
  client: remoteClient,
  nativeSessionReadPort: {
    async getNativeSession() {
      return null;
    },
    async listNativeSessionPage() {
      return null;
    },
  },
});
await fallbackService.listNativeSessionPage(request);
await fallbackService.getNativeSession(nativeSummary.id, request);
assert.equal(remoteListCalls, 1, 'unmounted/browser sessions must preserve generated SDK fallback');
assert.equal(remoteGetCalls, 1, 'unmounted/browser detail must preserve generated SDK fallback');

const desktopEntrySource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
    import.meta.url,
  ),
  'utf8',
);
for (const command of ['desktop_native_session_list', 'desktop_native_session_get']) {
  assert.match(
    desktopEntrySource,
    new RegExp(`async fn ${command}\\b`, 'u'),
    `${command} must be an async Tauri command so provider scans never block the UI thread`,
  );
  assert.match(
    desktopEntrySource,
    new RegExp(`generate_handler!\\[[\\s\\S]*\\b${command},`, 'u'),
    `${command} must be registered in the desktop invoke handler`,
  );
}

console.log('tauri native session composition contract passed');
