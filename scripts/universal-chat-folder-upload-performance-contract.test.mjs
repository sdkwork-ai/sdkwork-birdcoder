import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const zhLocale = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/zh/chat.ts', import.meta.url),
  'utf8',
);
const enLocale = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/en/chat.ts', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const MAX_FOLDER_UPLOAD_INPUT_CHARACTERS = \d+;/,
  'UniversalChat should define an explicit total composer append budget for folder uploads so large directories cannot freeze the chat composer.',
);

assert.match(
  source,
  /const MAX_FOLDER_UPLOAD_FILE_CHARACTERS = \d+;/,
  'UniversalChat should define a per-file excerpt cap for folder uploads so a single large text file cannot monopolize the composer payload.',
);

assert.match(
  source,
  /function buildFolderUploadContentBlock\(/,
  'UniversalChat should centralize folder-upload block construction behind a helper so truncation and formatting remain consistent.',
);

assert.match(
  source,
  /if \(nextInputLength > MAX_FOLDER_UPLOAD_INPUT_CHARACTERS\) \{/,
  'UniversalChat should stop appending folder-upload content once the composer budget is reached.',
);

assert.match(
  zhLocale,
  /folderAttachedTruncated:/,
  'Chinese chat locale should expose a dedicated folder-upload truncation message.',
);

assert.match(
  enLocale,
  /folderAttachedTruncated:/,
  'English chat locale should expose a dedicated folder-upload truncation message.',
);

console.log('universal chat folder upload performance contract passed.');
