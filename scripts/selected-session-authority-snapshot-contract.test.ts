import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  shouldSynchronizeSelectedSessionAuthoritySnapshot,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/selectedSessionSynchronization.ts';

assert.equal(
  shouldSynchronizeSelectedSessionAuthoritySnapshot({
    authorityAvailable: true,
    hasSynchronizedCurrentRequest: false,
    shouldBootstrapFromAuthority: false,
  }),
  true,
  'A selected session must load an authority snapshot even when its local project/session shell already exists.',
);

assert.equal(
  shouldSynchronizeSelectedSessionAuthoritySnapshot({
    authorityAvailable: true,
    hasSynchronizedCurrentRequest: true,
    shouldBootstrapFromAuthority: false,
  }),
  false,
  'Realtime transcript mutations must not trigger another authority snapshot after the current selection request is synchronized.',
);

assert.equal(
  shouldSynchronizeSelectedSessionAuthoritySnapshot({
    authorityAvailable: true,
    hasSynchronizedCurrentRequest: true,
    shouldBootstrapFromAuthority: true,
  }),
  true,
  'A missing local project/session location must always bootstrap from authority.',
);

assert.equal(
  shouldSynchronizeSelectedSessionAuthoritySnapshot({
    authorityAvailable: false,
    hasSynchronizedCurrentRequest: false,
    shouldBootstrapFromAuthority: true,
  }),
  false,
  'Local-only runtimes must not pretend an unavailable authority snapshot can run.',
);

const hookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedCodingSessionMessages.ts', import.meta.url),
  'utf8',
);

assert.match(
  hookSource,
  /const shouldRunAuthorityRefresh = shouldSynchronizeAuthority;/,
  'An empty local transcript must not suppress the selected-session authority snapshot merely because SSE or WebSocket is available.',
);

assert.doesNotMatch(
  hookSource,
  /!canUseWorkspaceRealtime\s*&&\s*shouldHydrateLocalTranscript\s*&&\s*\(localTranscriptCodingSession\?\.messages\.length \?\? 0\) === 0/,
  'Realtime availability must never be used as evidence that historical session messages were already loaded.',
);

console.log('selected session authority snapshot contract passed.');
