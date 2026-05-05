import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const codePageSessionSelectionPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'useCodePageSessionSelection.ts',
);
const studioSyncPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'useStudioCodingSessionSync.ts',
);

const codePageSessionSelectionSource = fs.readFileSync(codePageSessionSelectionPath, 'utf8');
const studioSyncSource = fs.readFileSync(studioSyncPath, 'utf8');

assert.match(
  codePageSessionSelectionSource,
  /lastNotifiedCodingSessionSelectionKeyRef\s*=\s*useRef<string \| null>\(null\)/,
  'Code page session selection must track the last notified project-scoped coding session key so parent selection sync cannot loop on the same local session.',
);

assert.match(
  codePageSessionSelectionSource,
  /if \(nextSelectionKey === initialSelectionKey\) \{\s*lastNotifiedCodingSessionSelectionKeyRef\.current = nextSelectionKey;[\s\S]*return;\s*\}/s,
  'Code page session selection must align its notification dedupe ref when the parent has already accepted the current project-scoped coding session selection.',
);

assert.match(
  codePageSessionSelectionSource,
  /if \(lastNotifiedCodingSessionSelectionKeyRef\.current === nextSelectionKey\) \{\s*return;\s*\}/s,
  'Code page session selection must not notify the parent repeatedly for the same local project-scoped coding session key.',
);

assert.match(
  studioSyncSource,
  /lastNotifiedCodingSessionIdRef\s*=\s*useRef<string>\(''\)/,
  'Studio session sync must track the last notified project-scoped coding session key so the shell selection cannot bounce indefinitely.',
);

assert.match(
  studioSyncSource,
  /if \(selectedSelectionKey === initialSelectionKey\) \{\s*lastNotifiedCodingSessionIdRef\.current = selectedSelectionKey;[\s\S]*return;\s*\}/s,
  'Studio session sync must align its notification dedupe ref when the shell has already accepted the current project-scoped coding session selection.',
);

assert.match(
  studioSyncSource,
  /if \(lastNotifiedCodingSessionIdRef\.current === selectedSelectionKey\) \{\s*return;\s*\}/s,
  'Studio session sync must not re-notify the shell for the same local project-scoped coding session key.',
);

console.log('code session sync loop contract passed.');
