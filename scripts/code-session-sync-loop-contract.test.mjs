import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const codePagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioSyncPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'useStudioCodingSessionSync.ts',
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const studioSyncSource = fs.readFileSync(studioSyncPath, 'utf8');

assert.match(
  codePageSource,
  /lastNotifiedCodingSessionIdRef\s*=\s*useRef<string \| null>\(null\)/,
  'CodePage must track the last notified coding session id so parent selection sync cannot loop on the same local session.',
);

assert.match(
  codePageSource,
  /if \(nextCodingSessionId === normalizedInitialCodingSessionId\) \{\s*lastNotifiedCodingSessionIdRef\.current = nextCodingSessionId;\s*return;\s*\}/s,
  'CodePage must align its notification dedupe ref when the parent has already accepted the current coding session selection.',
);

assert.match(
  codePageSource,
  /if \(lastNotifiedCodingSessionIdRef\.current === nextCodingSessionId\) \{\s*return;\s*\}/s,
  'CodePage must not notify the parent repeatedly for the same local coding session id.',
);

assert.match(
  studioSyncSource,
  /lastNotifiedCodingSessionIdRef\s*=\s*useRef<string>\(''\)/,
  'Studio session sync must track the last notified coding session id so the shell selection cannot bounce indefinitely.',
);

assert.match(
  studioSyncSource,
  /if \(selectedCodingSessionId === normalizedInitialCodingSessionId\) \{\s*lastNotifiedCodingSessionIdRef\.current = selectedCodingSessionId;\s*return;\s*\}/s,
  'Studio session sync must align its notification dedupe ref when the shell has already accepted the current coding session selection.',
);

assert.match(
  studioSyncSource,
  /if \(lastNotifiedCodingSessionIdRef\.current === selectedCodingSessionId\) \{\s*return;\s*\}/s,
  'Studio session sync must not re-notify the shell for the same local coding session id.',
);

console.log('code session sync loop contract passed.');
