import type { WorkbenchAgentTurnDriveRef } from '@sdkwork/birdcoder-pc-workbench/chat/agentTurnInputQueueStore';

export type ComposerAttachmentKind = 'file' | 'image';

export type ComposerAttachmentStatus = 'failed' | 'ready' | 'uploading';

export interface ComposerAttachmentDraft {
  readonly contentBlock?: string;
  readonly displayName: string;
  readonly driveRef?: WorkbenchAgentTurnDriveRef;
  readonly file: File;
  readonly id: string;
  readonly kind: ComposerAttachmentKind;
  readonly mimeType: string;
  readonly previewUrl?: string;
  readonly sizeBytes: number;
  readonly status: ComposerAttachmentStatus;
}

export function resolveComposerAttachmentResourceRole(
  attachment: Pick<ComposerAttachmentDraft, 'kind' | 'mimeType'>,
): WorkbenchAgentTurnDriveRef['resourceRole'] {
  if (attachment.kind === 'image') {
    return 'image';
  }
  if (attachment.mimeType.trim().toLowerCase().startsWith('audio/')) {
    return 'audio';
  }
  return 'attachment';
}

let composerAttachmentSequence = 0;

const TEXT_FILE_EXTENSION_PATTERN = /\.(?:c|cc|conf|cpp|cs|css|csv|dart|env|go|h|hpp|html?|ini|java|js|json|jsx|kt|kts|less|log|md|mdx|mjs|php|properties|py|rb|rs|scss|sh|sql|svg|swift|toml|ts|tsx|txt|vue|xml|ya?ml)$/iu;

export function resolveComposerAttachmentKind(file: File): ComposerAttachmentKind {
  return file.type.trim().toLowerCase().startsWith('image/') ? 'image' : 'file';
}

export function isComposerAttachmentTextFile(file: File): boolean {
  const mimeType = file.type.trim().toLowerCase();
  return (
    mimeType.startsWith('text/')
    || mimeType.includes('json')
    || mimeType.includes('xml')
    || mimeType.includes('yaml')
    || (!mimeType && TEXT_FILE_EXTENSION_PATTERN.test(file.name))
  );
}

export function resolveComposerAttachmentSignature(file: File): string {
  return [
    file.name.trim().toLowerCase(),
    file.size,
    file.type.trim().toLowerCase(),
    file.lastModified,
  ].join('\u0001');
}

export function createComposerAttachmentDraft(
  file: File,
  options: {
    displayName?: string;
    previewUrl?: string;
  } = {},
): ComposerAttachmentDraft {
  composerAttachmentSequence += 1;
  return {
    displayName: options.displayName?.trim() || file.name || 'attachment',
    file,
    id: `composer-attachment-${Date.now()}-${composerAttachmentSequence}`,
    kind: resolveComposerAttachmentKind(file),
    mimeType: file.type.trim() || 'application/octet-stream',
    ...(options.previewUrl ? { previewUrl: options.previewUrl } : {}),
    sizeBytes: file.size,
    status: 'uploading',
  };
}

export function buildComposerSubmissionText(
  visibleText: string,
  attachments: readonly ComposerAttachmentDraft[],
): string {
  const attachmentContent = attachments
    .filter((attachment) => attachment.status === 'ready' && attachment.contentBlock)
    .map((attachment) => attachment.contentBlock)
    .join('');
  return `${visibleText.trim()}${attachmentContent}`.trim();
}

export function formatComposerAttachmentSize(sizeBytes: number, locale?: string): string {
  const normalizedSizeBytes = Math.max(0, sizeBytes);
  if (normalizedSizeBytes < 1024) {
    return `${normalizedSizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'] as const;
  let value = normalizedSizeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
}

export function revokeComposerAttachmentPreview(attachment: ComposerAttachmentDraft): void {
  if (
    attachment.previewUrl?.startsWith('blob:')
    && typeof URL !== 'undefined'
    && typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}
