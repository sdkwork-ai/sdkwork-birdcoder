import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const runtimeFileSystemSource = await readFile(
  resolve(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);

assert.match(
  runtimeFileSystemSource,
  /interface BrowserFileLike \{[\s\S]*arrayBuffer\?\(\): Promise<ArrayBuffer>;/,
  'Browser-mounted file snapshots must expose byte-preserving reads for rename and directory copy operations.',
);

assert.match(
  runtimeFileSystemSource,
  /async function copyBrowserFileSnapshot\([\s\S]*file\.arrayBuffer \? await file\.arrayBuffer\(\) : await file\.text\(\)[\s\S]*await writable\.write\(payload\);[\s\S]*await writable\.close\(\);/,
  'Browser-mounted rename must prefer ArrayBuffer payloads and complete the writable stream before deleting the source.',
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
