import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

assert.match(
  fileSystemSource,
  /const openFileContentCacheRef = useRef<Map<string, string>>\(new Map\(\)\);/,
  'useFileSystem must keep an in-memory content cache for opened files so switching back to an already-open tab does not always force a fresh filesystem read before anything can render.',
);

assert.match(
  fileSystemSource,
  /const setCachedFileContent = useCallback\(\(path: string, content: string\) =>/,
  'useFileSystem must define a dedicated cache update helper so selected-file loads, autosave drafts, and persisted writes update the same open-file content cache consistently.',
);

assert.match(
  fileSystemSource,
  /const cachedContent = openFileContentCacheRef\.current\.get\(requestSelectedFile\);/,
  'useFileSystem must check the open-file content cache before reading selected file content from the filesystem.',
);

assert.match(
  fileSystemSource,
  /if \(cachedContent !== undefined\) \{\s*commitVisibleFileContent\(cachedContent\);\s*void syncSelectedFileFromSource\(requestProjectId, requestSelectedFile\);\s*return;\s*\}/s,
  'useFileSystem must render cached selected-file content immediately and defer validation to the revision-first sync path instead of blocking tab switches on a filesystem read.',
);

assert.match(
  fileSystemSource,
  /pruneCachedFileContent\(normalizedState\.openFilePaths\);/,
  'useFileSystem must prune cached file content when tabs close so the cache stays bounded to the active open-file set.',
);

console.log('file system open file cache performance contract passed.');
