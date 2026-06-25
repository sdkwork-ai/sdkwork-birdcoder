import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const zhLocale = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/chat.ts', import.meta.url),
  'utf8',
);
const enLocale = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/chat.ts', import.meta.url),
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
  'UniversalChat should define an explicit image byte limit before uploading attachments to Drive.',
);

assert.match(
  source,
  /uploadBirdCoderChatAttachmentToDrive/,
  'UniversalChat should upload chat attachments through the canonical Drive app SDK instead of embedding base64 payloads in composer state.',
);

assert.match(
  source,
  /buildDriveMediaResourceContentBlock/,
  'UniversalChat should build composer attachment blocks from Drive media resources instead of inline data URLs.',
);

assert.doesNotMatch(
  source,
  /MAX_IMAGE_UPLOAD_DATA_URL_CHARACTERS/,
  'UniversalChat should not keep a base64 data URL budget after migrating image uploads to Drive.',
);

assert.doesNotMatch(
  source,
  /estimateImageUploadDataUrlCharacters/,
  'UniversalChat should not estimate base64 payload size after migrating image uploads to Drive.',
);

assert.doesNotMatch(
  source,
  /buildImageUploadContentBlock/,
  'UniversalChat should not build inline image data URL blocks after migrating image uploads to Drive.',
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
  /if \(file\.size > MAX_IMAGE_UPLOAD_BYTES\) \{[\s\S]*addToast\(t\('chat\.imageTooLarge'\), 'error'\);[\s\S]*return;/s,
  'UniversalChat should reject oversized images before uploading them to Drive.',
);

assert.match(
  source,
  /const driveUpload = await uploadBirdCoderChatAttachmentToDrive\([\s\S]*profile: 'image',[\s\S]*\);[\s\S]*const imageContentBlock = buildDriveMediaResourceContentBlock\([\s\S]*driveUpload\.mediaResource,[\s\S]*driveUpload\.previewUrl,[\s\S]*\);/s,
  'UniversalChat should upload images through Drive and append a bounded media resource block to composer state.',
);

assert.match(
  source,
  /addToast\(t\('chat\.driveUploadFailed'\), 'error'\);/,
  'UniversalChat should surface Drive upload failures through a dedicated chat toast key.',
);

assert.match(
  source,
  /if \(file\.size > MAX_SINGLE_FILE_UPLOAD_BYTES\) \{[\s\S]*addToast\(t\('chat\.fileTooLarge'\), 'error'\);[\s\S]*return;/s,
  'UniversalChat should reject oversized single-file uploads before readFileAsText allocates file contents on the UI thread.',
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

assert.match(
  zhLocale,
  /driveUploadFailed:/,
  'Chinese chat locale should expose a dedicated Drive upload failure message.',
);

assert.match(
  enLocale,
  /driveUploadFailed:/,
  'English chat locale should expose a dedicated Drive upload failure message.',
);

console.log('universal chat folder upload performance contract passed.');
