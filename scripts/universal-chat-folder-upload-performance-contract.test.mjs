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
  /const MAX_SINGLE_FILE_UPLOAD_BYTES = \d+;/,
  'UniversalChat should define an explicit single-file byte limit before reading text into memory.',
);

assert.match(
  source,
  /const MAX_SINGLE_FILE_UPLOAD_CHARACTERS = \d+;/,
  'UniversalChat should define an explicit single-file composer append budget so a large text file cannot freeze input rendering.',
);

assert.match(
  source,
  /const MAX_IMAGE_UPLOAD_BYTES = \d+;/,
  'UniversalChat should define an explicit image byte limit before readAsDataURL expands the payload in memory.',
);

assert.match(
  source,
  /const MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS = \d+;/,
  'UniversalChat should define an explicit image data URL character budget so base64 attachments cannot bloat the composer state.',
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
  /function buildSingleFileUploadContentBlock\(/,
  'UniversalChat should centralize single-file upload block construction so truncation and formatting remain consistent.',
);

assert.match(
  source,
  /function estimateImageUploadDataUrlCharacters\(/,
  'UniversalChat should estimate image data URL payload size before allocating the base64 string.',
);

assert.match(
  source,
  /function buildImageUploadContentBlock\(/,
  'UniversalChat should centralize image upload block construction behind a bounded helper.',
);

assert.match(
  source,
  /if \(file\.size > MAX_SINGLE_FILE_UPLOAD_BYTES\) \{[\s\S]*addToast\(t\('chat\.fileTooLarge'\), 'error'\);[\s\S]*return;/s,
  'UniversalChat should reject oversized single-file uploads before readFileAsText allocates file contents on the UI thread.',
);

assert.match(
  source,
  /if \(\s*file\.size > MAX_IMAGE_UPLOAD_BYTES \|\|[\s\S]*estimateImageUploadDataUrlCharacters\(file\) > MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS[\s\S]*\) \{[\s\S]*addToast\(t\('chat\.imageTooLarge'\), 'error'\);[\s\S]*return;/s,
  'UniversalChat should reject oversized images before readFileAsDataUrl expands them into base64 on the UI thread.',
);

assert.match(
  source,
  /const imageContentBlock = buildImageUploadContentBlock\(file\.name, base64\);[\s\S]*if \(!imageContentBlock\) \{[\s\S]*addToast\(t\('chat\.imageTooLarge'\), 'error'\);[\s\S]*return;[\s\S]*\}/s,
  'UniversalChat should verify the actual image data URL budget before appending it to composer state.',
);

assert.match(
  source,
  /const \{ block: fileContentBlock, isTruncated \} = buildSingleFileUploadContentBlock\(\s*file\.name,\s*content,\s*\);/s,
  'UniversalChat should build single-file upload content through the bounded truncating helper.',
);

assert.doesNotMatch(
  source,
  /`\\n\\nFile: \$\{file\.name\}\\n\\`\\`\\`\\n\$\{content\}\\n\\`\\`\\`\\n`/,
  'UniversalChat should not append an unbounded single-file text payload directly into the composer.',
);

assert.doesNotMatch(
  source,
  /appendChatInput\(inputValueRef\.current, `\\n!\[\$\{file\.name\}\]\(\$\{base64\}\)\\n`\)/,
  'UniversalChat should not append an unbounded image data URL directly into the composer.',
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
  zhLocale,
  /fileTooLarge:/,
  'Chinese chat locale should expose a dedicated single-file size-limit message.',
);

assert.match(
  zhLocale,
  /fileAttachedTruncated:/,
  'Chinese chat locale should expose a dedicated single-file truncation message.',
);

assert.match(
  zhLocale,
  /imageTooLarge:.*1MB/,
  'Chinese chat locale should communicate the bounded image upload budget.',
);

assert.match(
  enLocale,
  /folderAttachedTruncated:/,
  'English chat locale should expose a dedicated folder-upload truncation message.',
);

assert.match(
  enLocale,
  /fileTooLarge:/,
  'English chat locale should expose a dedicated single-file size-limit message.',
);

assert.match(
  enLocale,
  /fileAttachedTruncated:/,
  'English chat locale should expose a dedicated single-file truncation message.',
);

assert.match(
  enLocale,
  /imageTooLarge:.*1MB/,
  'English chat locale should communicate the bounded image upload budget.',
);

console.log('universal chat folder upload performance contract passed.');
