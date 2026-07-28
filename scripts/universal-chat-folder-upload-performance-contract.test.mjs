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
  /const MAX_COMPOSER_ATTACHMENTS = \d+;/,
  'UniversalChat should bound the number of attachment cards and concurrent uploads in one composer.',
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
  /function buildSingleFileUploadContentBlock\(/,
  'UniversalChat should centralize single-file upload block construction so truncation and formatting remain consistent.',
);

assert.match(
  source,
  /const maxBytes = isImage \? MAX_IMAGE_UPLOAD_BYTES : MAX_SINGLE_FILE_UPLOAD_BYTES;[\s\S]*if \(file\.size > maxBytes\)/s,
  'UniversalChat should reject oversized images and files before uploading them to Drive.',
);

assert.match(
  source,
  /const uploadComposerAttachment = useCallback\(async[\s\S]*signal: AbortSignal[\s\S]*uploadBirdCoderChatAttachmentToDrive\(\{[\s\S]*resourceId: normalizedSessionId \|\| normalizedTranscriptScopeKey,[\s\S]*profile: resolveChatAttachmentUploadProfile\(attachment\.file\),[\s\S]*signal,[\s\S]*buildDriveMediaResourceContentBlock\(/s,
  'UniversalChat should upload every attachment through Drive with the canonical profile and an abortable request.',
);

assert.match(
  source,
  /catch \(error\) \{[\s\S]*updateComposerAttachment\(attachment\.id,[\s\S]*status: 'failed'/s,
  'UniversalChat should surface Drive upload failures through a failed attachment card that remains retryable.',
);

assert.doesNotMatch(
  source,
  /t\('chat\.attachmentUploadFailedNamed'/,
  'UniversalChat should not stack one toast per failed attachment because the tray already presents each failure.',
);

assert.match(
  source,
  /const fileContent = buildSingleFileUploadContentBlock\(\s*attachment\.displayName,\s*content,\s*\);/s,
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

assert.doesNotMatch(
  source,
  /setInputValue\([\s\S]{0,200}driveContentBlock/,
  'Attachment resource blocks must stay out of visible textarea state.',
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

for (const locale of [zhLocale, enLocale]) {
  assert.match(locale, /attachmentUploading:/);
  assert.match(locale, /attachmentUploadFailed:/);
  assert.match(locale, /removeAttachment:/);
  assert.match(locale, /retryAttachment:/);
}

console.log('universal chat folder upload performance contract passed.');
