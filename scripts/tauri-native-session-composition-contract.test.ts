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
  runtimeLocationId: 'runtime-location-1',
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

const request = {
  projectId: 'project-1',
  runtimeLocationId: 'runtime-location-1',
  workspaceId: 'workspace-1',
};
const appApiService = new ApiBackedAppRuntimeReadService({ client: remoteClient });
assert.deepEqual(await appApiService.listNativeSessions(request), [nativeSummary]);
assert.deepEqual(await appApiService.listNativeSessionPage(request), nativePage);
assert.deepEqual(await appApiService.getNativeSession(nativeSummary.id, request), nativeDetail);
assert.equal(remoteListCalls, 2, 'native inventory must be served only by the App SDK client');
assert.equal(remoteGetCalls, 1, 'native session detail must be served only by the App SDK client');

const desktopEntrySource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
    import.meta.url,
  ),
  'utf8',
);
const hostCommandSource = fs.readFileSync(
  new URL(
    '../crates/sdkwork-birdcoder-tauri-host/src/commands/session_commands.rs',
    import.meta.url,
  ),
  'utf8',
);
const runtimeReadServiceSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts',
    import.meta.url,
  ),
  'utf8',
);
const infrastructurePackageSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json',
    import.meta.url,
  ),
  'utf8',
);
const infrastructureComponentSpecSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/specs/component.spec.json',
    import.meta.url,
  ),
  'utf8',
);
const infrastructureReadmeSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/specs/README.md',
    import.meta.url,
  ),
  'utf8',
);
const pcArchitectureSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md',
    import.meta.url,
  ),
  'utf8',
);

for (const source of [desktopEntrySource, hostCommandSource]) {
  assert.equal(
    source.includes('desktop_native_session_'),
    false,
    'Tauri must not expose provider-native session reads that accept a renderer path.',
  );
}
assert.equal(
  runtimeReadServiceSource.includes('nativeSessionReadPort'),
  false,
  'The application runtime reader must not accept a client-side native session override.',
);
assert.equal(
  infrastructurePackageSource.includes('tauriNativeSessions'),
  false,
  'The retired path-based Tauri native session adapter must not remain exported.',
);
for (const source of [infrastructureComponentSpecSource, infrastructureReadmeSource]) {
  assert.equal(
    source.includes('tauriNativeSessions'),
    false,
    'Component contracts and documentation must not advertise the retired Tauri native-session adapter.',
  );
}
assert.equal(
  pcArchitectureSource.includes('Tauri native detail reads'),
  false,
  'PC architecture documentation must not describe Tauri as a provider-native session read path.',
);
assert.match(
  pcArchitectureSource,
  /authenticated\s+BirdCoder App API/u,
  'PC architecture documentation must describe the authenticated App API authorization boundary.',
);
assert.match(
  infrastructureComponentSpecSource,
  /"@sdkwork\/birdcoder-app-sdk"/u,
  'The infrastructure component contract must declare its composed BirdCoder App SDK dependency.',
);
assert.equal(
  fs.existsSync(
    new URL(
      '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriNativeSessions.ts',
      import.meta.url,
    ),
  ),
  false,
  'The retired path-based Tauri native session adapter must not remain in the source tree.',
);

console.log('tauri native session authorization contract passed');
