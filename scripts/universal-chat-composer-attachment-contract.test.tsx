import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { ComposerAttachmentTray } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/ComposerAttachmentTray.tsx';
import {
  buildComposerSubmissionText,
  createComposerAttachmentDraft,
  isComposerAttachmentTextFile,
  resolveComposerAttachmentKind,
  resolveComposerAttachmentSignature,
  type ComposerAttachmentDraft,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/composerAttachmentDraft.ts';
import {
  ComposerAttachmentUploadScheduler,
  MAX_CONCURRENT_COMPOSER_ATTACHMENT_UPLOADS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/composerAttachmentUploadScheduler.ts';

const textFile = new File(['const answer = 42;'], 'answer.ts', {
  lastModified: 1,
  type: 'text/typescript',
});
const imageFile = new File(['image'], 'screen.png', {
  lastModified: 2,
  type: 'image/png',
});

assert.equal(resolveComposerAttachmentKind(textFile), 'file');
assert.equal(resolveComposerAttachmentKind(imageFile), 'image');
assert.equal(isComposerAttachmentTextFile(textFile), true);
assert.equal(isComposerAttachmentTextFile(new File(['zip'], 'source.zip')), false);
assert.equal(
  resolveComposerAttachmentSignature(textFile),
  resolveComposerAttachmentSignature(textFile),
  'Attachment signatures must be stable so picker and clipboard duplicates can be rejected.',
);

const readyAttachment: ComposerAttachmentDraft = {
  ...createComposerAttachmentDraft(textFile),
  contentBlock: '\n\n[DRIVE_MEDIA:{"id":"answer"}]\n',
  status: 'ready',
};
const uploadingAttachment = createComposerAttachmentDraft(imageFile, {
  previewUrl: 'blob:screen-preview',
});
const failedAttachment: ComposerAttachmentDraft = {
  ...createComposerAttachmentDraft(new File(['pdf'], 'spec.pdf', { type: 'application/pdf' })),
  status: 'failed',
};

assert.equal(
  buildComposerSubmissionText('Review this', [readyAttachment, uploadingAttachment, failedAttachment]),
  'Review this\n\n[DRIVE_MEDIA:{"id":"answer"}]',
  'Only ready attachment payloads may enter the submitted Agent turn.',
);
assert.equal(
  buildComposerSubmissionText('', [readyAttachment]),
  '[DRIVE_MEDIA:{"id":"answer"}]',
  'A ready attachment must be sendable without placeholder textarea text.',
);

const uploadScheduler = new ComposerAttachmentUploadScheduler();
const startedUploads: string[] = [];
const releaseUploads = new Map<string, () => void>();
for (let index = 0; index < MAX_CONCURRENT_COMPOSER_ATTACHMENT_UPLOADS + 2; index += 1) {
  const id = `attachment-${index}`;
  uploadScheduler.enqueue({
    id,
    run: (signal) => new Promise<void>((resolve) => {
      startedUploads.push(id);
      const release = () => resolve();
      releaseUploads.set(id, release);
      signal.addEventListener('abort', release, { once: true });
    }),
  });
}
await Promise.resolve();
await Promise.resolve();
assert.equal(uploadScheduler.activeCount, MAX_CONCURRENT_COMPOSER_ATTACHMENT_UPLOADS);
assert.equal(uploadScheduler.pendingCount, 2);
assert.deepEqual(
  startedUploads,
  ['attachment-0', 'attachment-1', 'attachment-2', 'attachment-3'],
  'The composer must cap independent Drive uploads without reordering pending files.',
);
uploadScheduler.cancel('attachment-4');
releaseUploads.get('attachment-0')?.();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(startedUploads.includes('attachment-4'), false);
assert.equal(startedUploads.includes('attachment-5'), true);
uploadScheduler.clear();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(uploadScheduler.activeCount, 0);
assert.equal(uploadScheduler.pendingCount, 0);

const i18n = createInstance();
await i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: 'en',
  resources: {
    en: {
      translation: {
        chat: {
          attachedFiles: 'Attached files',
          attachmentFile: 'File',
          attachmentImage: 'Image',
          attachmentUploadFailed: 'Upload failed',
          attachmentUploading: 'Uploading',
          removeAttachment: 'Remove attachment',
          retryAttachment: 'Retry upload',
        },
      },
    },
  },
});

const attachmentTrayHtml = renderToStaticMarkup(
  <I18nextProvider i18n={i18n}>
    <ComposerAttachmentTray
      attachments={[readyAttachment, uploadingAttachment, failedAttachment]}
      onRemove={() => undefined}
      onRetry={() => undefined}
    />
  </I18nextProvider>,
);
assert.match(attachmentTrayHtml, /data-composer-attachment-tray="true"/u);
assert.equal(
  [...attachmentTrayHtml.matchAll(/data-composer-attachment-status=/gu)].length,
  3,
  'The tray must render every attachment without resizing the textarea content.',
);
assert.match(attachmentTrayHtml, /data-composer-attachment-status="ready"/u);
assert.match(attachmentTrayHtml, /data-composer-attachment-status="uploading"/u);
assert.match(attachmentTrayHtml, /data-composer-attachment-status="failed"/u);
assert.match(attachmentTrayHtml, /aria-label="Retry upload: spec\.pdf"/u);
assert.match(attachmentTrayHtml, /aria-label="Remove attachment: screen\.png"/u);
assert.match(attachmentTrayHtml, /src="blob:screen-preview"/u);

const universalChatSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx'),
  'utf8',
);
const sharedFooterSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/SharedComposerFooter.tsx'),
  'utf8',
);
const composerActionPanelSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/composer/ComposerActionPanel.tsx'),
  'utf8',
);

assert.match(
  universalChatSource,
  /const handleComposerPaste = useCallback\([\s\S]*resolveClipboardFiles\(event\.clipboardData\)[\s\S]*event\.preventDefault\(\);[\s\S]*addComposerFiles\(clipboardFiles\);/u,
  'The textarea paste event must capture clipboard files and route them through the canonical attachment pipeline.',
);
assert.match(
  universalChatSource,
  /<ComposerAttachmentTray[\s\S]*<textarea[\s\S]*onPaste=\{handleComposerPaste\}/u,
  'Attachment previews must render above the textarea and the textarea must own Ctrl/Cmd+V paste handling.',
);
assert.match(
  universalChatSource,
  /uploadBirdCoderChatAttachmentToDrive\(\{[\s\S]*signal,/u,
  'Attachment removal and scope changes must be able to abort in-flight Drive uploads.',
);
assert.match(
  universalChatSource,
  /scheduleComposerAttachmentUpload\(attachment\)/u,
  'Every composer attachment source and retry path must use the bounded upload scheduler.',
);
assert.match(
  universalChatSource,
  /const currentSubmission = buildComposerSubmissionText\(currentInput, readyAttachments\);/u,
  'Ready attachment payloads must be combined only at submission time, outside textarea state.',
);
assert.match(
  universalChatSource,
  /composerAttachmentScopeRef\.current = normalizedTranscriptScopeKey;[\s\S]*clearComposerAttachments\(\);/u,
  'Transient attachment drafts must be cleared when the visible Session scope changes.',
);
assert.match(
  universalChatSource,
  /const handleCloseComposerActionPanel = useCallback\(\(\) => \{[\s\S]*setShowAttachmentMenu\(false\);[\s\S]*\}, \[\]\);[\s\S]*<ComposerActionPanel[\s\S]*onClose=\{handleCloseComposerActionPanel\}/u,
  'The action panel must receive a stable close callback so parent updates do not churn its document listener.',
);
assert.match(
  sharedFooterSource,
  /ref=\{fileInputRef\}[\s\S]*multiple[\s\S]*onChange=\{onFileUpload\}/u,
  'The plus-menu file picker must support selecting more than one file.',
);
assert.match(
  sharedFooterSource,
  /aria-haspopup="menu"/u,
  'The plus control must expose popup-menu semantics to assistive technology.',
);
assert.match(
  sharedFooterSource,
  /aria-label=\{t\('chat\.addAttachment'\)\}/u,
  'The plus control must expose an accessible attachment action name.',
);
assert.match(
  composerActionPanelSource,
  /useEffect\(\(\) => \{[\s\S]*document\.addEventListener\('keydown', handleKeyDown, true\);[\s\S]*document\.removeEventListener\('keydown', handleKeyDown, true\);[\s\S]*\}, \[onClose\]\);/u,
  'The action panel must close from Escape regardless of focus and must release its document listener on unmount.',
);
assert.match(
  composerActionPanelSource,
  /if \(event\.key !== 'Escape'\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*onClose\(\);/u,
  'The action panel must consume Escape before closing so the keystroke cannot trigger an underlying surface.',
);
assert.match(
  composerActionPanelSource,
  /shouldRestoreFocus && previouslyFocusedElement\?\.isConnected[\s\S]*window\.requestAnimationFrame\(\(\) => previouslyFocusedElement\.focus\(\)\);/u,
  'Escape dismissal must restore focus to the control that opened the action panel.',
);

console.log('universal chat composer attachment contract passed.');
