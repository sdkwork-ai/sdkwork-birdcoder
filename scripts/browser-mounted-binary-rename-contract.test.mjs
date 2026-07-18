import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtimeFileSystemSource = await readFile(
  resolve(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);

function extractMethod(source, methodName, nextMethodName) {
  const start = source.indexOf(`  private async ${methodName}(`);
  const end = source.indexOf(`  private async ${nextMethodName}(`, start + 1);
  assert.notEqual(start, -1, `${methodName} must exist.`);
  assert.notEqual(end, -1, `${nextMethodName} must follow ${methodName}.`);
  return source.slice(start, end);
}

assert.match(
  runtimeFileSystemSource,
  /interface BrowserFileLike \{[\s\S]*stream\?\(\): ReadableStream<Uint8Array>;/,
  'Browser-mounted file snapshots must expose streaming reads for rename and directory copy operations.',
);

assert.match(
  runtimeFileSystemSource,
  /async function copyBrowserFileSnapshot\([\s\S]*stream\.getReader\(\)[\s\S]*await reader\.read\(\)[\s\S]*await writable\.write\(value\)[\s\S]*await writable\.close\(\);/,
  'Browser-mounted rename must stream file chunks and complete the writable stream before deleting the source.',
);

assert.match(
  runtimeFileSystemSource,
  /file\.size > DEFAULT_BROWSER_FILE_MAX_BYTES/,
  'Browser-mounted non-streaming fallbacks must reject files above the bounded memory limit.',
);

const browserReadSource = extractMethod(
  runtimeFileSystemSource,
  'readBrowserMountedFileContent',
  'readBrowserMountedFileRevision',
);
assert.doesNotMatch(
  browserReadSource,
  /this\.projectFileContent\[projectId\]\[path\] = content;/,
  'Mounted file reads must not retain every complete file body in the service cache.',
);

assert.match(
  runtimeFileSystemSource,
  /catch \(error\) \{[\s\S]*await writable\.abort\?\.\(\);[\s\S]*throw error;/,
  'Browser-mounted copy failures must abort the target stream while preserving the original error.',
);

assert.doesNotMatch(
  runtimeFileSystemSource,
  /writable\.write\(await file\.text\(\)\)/,
  'Browser-mounted file and directory rename paths must never decode arbitrary files as UTF-8 before copying them.',
);

const copyCallCount = runtimeFileSystemSource.match(/copyBrowserFileSnapshot\(file, writable\)/g)?.length ?? 0;
assert.equal(
  copyCallCount,
  2,
  'Both single-file rename and recursive directory rename must use the byte-preserving copy helper.',
);

console.log('browser-mounted binary rename contract passed.');
