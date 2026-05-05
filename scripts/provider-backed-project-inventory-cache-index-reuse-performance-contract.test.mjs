import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

const methodStart = serviceSource.indexOf(
  'private async loadPersistedCodingSessionInventorySnapshot(',
);
assert.notEqual(
  methodStart,
  -1,
  'ProviderBackedProjectService must define loadPersistedCodingSessionInventorySnapshot.',
);
const methodEnd = serviceSource.indexOf('\n  private async ', methodStart + 1);
const methodSource = serviceSource.slice(
  methodStart,
  methodEnd === -1 ? serviceSource.length : methodEnd,
);

assert.doesNotMatch(
  methodSource,
  /new Map\(cachedSessions\.map\(/,
  'inventory refresh must reuse the maintained sessionIndexesByProjectId map instead of rebuilding a project-wide cache lookup from cachedSessions.map(...).',
);
assert.match(
  methodSource,
  /this\.sessionIndexesByProjectId\.get\(projectId\)/,
  'inventory refresh must read cached sessions through the maintained O(1) session index.',
);
assert.match(
  methodSource,
  /const hasCachedTranscriptReuseByProjectId = new Map<string, boolean>\(\);/,
  'inventory refresh must track whether a project actually reused cached transcript arrays.',
);
assert.match(
  methodSource,
  /hasCachedTranscriptReuseByProjectId\.set\(session\.projectId,\s*true\);/,
  'inventory refresh must mark only projects that reused hydrated transcript arrays.',
);
assert.match(
  methodSource,
  /if \(hasCachedTranscriptReuseByProjectId\.get\(projectId\) === true\) \{[\s\S]*cacheSessions\.sort\(compareCodingSessionsByActivity\);[\s\S]*this\.setProjectSessionsCache\(projectId,\s*cacheSessions\);[\s\S]*\} else \{[\s\S]*this\.setProjectSessionsCache\(projectId,\s*sessions\);[\s\S]*\}/s,
  'inventory refresh must sort a second cache array only when cached transcripts were actually reused.',
);

console.log('provider-backed project inventory cache index reuse performance contract passed.');
