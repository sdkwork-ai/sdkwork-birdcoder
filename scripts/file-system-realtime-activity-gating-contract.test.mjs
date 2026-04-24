import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemHookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);
const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  fileSystemHookSource,
  /interface UseFileSystemOptions \{[\s\S]*loadActive\?: boolean;[\s\S]*\}/s,
  'useFileSystem should expose a dedicated loadActive flag so pages can defer file-tree and file-content loading until the code workspace is actually visible.',
);

assert.match(
  fileSystemHookSource,
  /const loadActive = options\?\.loadActive \?\? isActive;/,
  'useFileSystem should default loadActive to isActive so existing callers preserve behavior unless they opt into code-tab lazy loading.',
);

assert.match(
  fileSystemHookSource,
  /if \(!requestProjectId \|\| !loadActive\) \{/,
  'useFileSystem should gate file-tree hydration from the narrower loadActive flag so AI and preview tabs stop eagerly loading editor trees.',
);

assert.match(
  fileSystemHookSource,
  /if \(!requestProjectId \|\| !requestSelectedFile \|\| !loadActive\) return;/,
  'useFileSystem should gate file-content hydration from the narrower loadActive flag so inactive code workspaces stop loading selected-file contents.',
);

assert.match(
  fileSystemHookSource,
  /interface UseFileSystemOptions \{[\s\S]*realtimeActive\?: boolean;[\s\S]*\}/s,
  'useFileSystem should expose a dedicated realtimeActive flag so persistent hidden editor surfaces can retain state without continuing filesystem realtime work.',
);

assert.match(
  fileSystemHookSource,
  /const realtimeActive = options\?\.realtimeActive \?\? isActive;/,
  'useFileSystem should default realtimeActive to isActive so existing callers preserve behavior unless they opt into finer-grained gating.',
);

assert.match(
  fileSystemHookSource,
  /const shouldRunRealtimeSync = realtimeActive && isRealtimeDocumentActive;/,
  'useFileSystem should drive realtime sync from the dedicated realtime activity flag instead of the broader file-system loading activity flag.',
);

assert.match(
  codePageSource,
  /useFileSystem\(currentProjectId,\s*currentProject\?\.path,\s*\{\s*isActive:\s*isVisible,\s*loadActive:\s*isVisible && activeTab === 'editor',\s*realtimeActive:\s*isVisible && activeTab === 'editor',\s*\}\)/s,
  'CodePage should only load editor files and keep realtime sync active while the editor tab is active, while still preserving broader page visibility semantics.',
);

assert.match(
  studioPageSource,
  /useFileSystem\(currentProjectId,\s*currentProject\?\.path,\s*\{\s*isActive:\s*isVisible,\s*loadActive:\s*isVisible && activeTab === 'code',\s*realtimeActive:\s*isVisible && activeTab === 'code',\s*\}\)/s,
  'StudioPage should only load editor files and keep realtime sync active while the code workspace tab is active.',
);

console.log('file system realtime activity gating contract passed.');
