import { memo, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  History,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import {
  formatComposerAttachmentSize,
  type ComposerAttachmentDraft,
} from './composerAttachmentDraft.ts';

export interface ComposerAttachmentTrayProps {
  attachments: readonly ComposerAttachmentDraft[];
  disabled?: boolean;
  onRemove: (attachmentId: string) => void;
  onRetry: (attachmentId: string) => void;
  /**
   * Codex desktop `referencesPriorConversation`: when true the composer shows
   * a "Previous context" pill (`composer.priorContext.label`) that keeps the
   * prior conversation context included with the next turn.
   */
  referencesPriorConversation?: boolean;
  onRemoveReferencesPriorConversation?: () => void;
}

function resolveFileIcon(attachment: ComposerAttachmentDraft): ComponentType<LucideProps> {
  const mimeType = attachment.mimeType.toLowerCase();
  if (attachment.kind === 'image') {
    return FileImage;
  }
  if (mimeType.startsWith('audio/')) {
    return FileAudio;
  }
  if (mimeType.startsWith('video/')) {
    return FileVideo;
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
    return FileArchive;
  }
  if (
    mimeType.startsWith('text/')
    || mimeType.includes('json')
    || mimeType.includes('xml')
    || mimeType.includes('document')
    || mimeType.includes('pdf')
  ) {
    return FileText;
  }
  return File;
}

export const ComposerAttachmentTray = memo(function ComposerAttachmentTray({
  attachments,
  disabled = false,
  onRemove,
  onRetry,
  referencesPriorConversation = false,
  onRemoveReferencesPriorConversation,
}: ComposerAttachmentTrayProps) {
  const { i18n, t } = useTranslation();

  if (attachments.length === 0 && !referencesPriorConversation) {
    return null;
  }

  return (
    <section
      aria-label={t('chat.attachedFiles')}
      className="-mx-1 overflow-x-auto px-1 pb-1 custom-scrollbar"
      data-composer-attachment-tray="true"
    >
      <ul className="flex min-w-max items-stretch gap-2" aria-live="polite">
        {referencesPriorConversation ? (
          <li
            className="flex h-8 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-xs text-zinc-200"
            data-composer-prior-context-pill="true"
          >
            <History aria-hidden="true" className="shrink-0 text-zinc-400" size={13} />
            <span className="truncate">{t('chat.priorContextLabel')}</span>
            {onRemoveReferencesPriorConversation ? (
              <button
                type="button"
                aria-label={t('chat.priorContextRemoveAriaLabel')}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled}
                onClick={onRemoveReferencesPriorConversation}
                title={t('chat.priorContextRemoveAriaLabel')}
              >
                <X aria-hidden="true" size={12} />
              </button>
            ) : null}
          </li>
        ) : null}
        {attachments.map((attachment) => {
          const AttachmentIcon = resolveFileIcon(attachment);
          const isFailed = attachment.status === 'failed';
          const isUploading = attachment.status === 'uploading';
          const statusText = isFailed
            ? t('chat.attachmentUploadFailed')
            : isUploading
              ? t('chat.attachmentUploading')
              : `${attachment.kind === 'image' ? t('chat.attachmentImage') : t('chat.attachmentFile')} · ${formatComposerAttachmentSize(
                  attachment.sizeBytes,
                  i18n.resolvedLanguage ?? i18n.language,
                )}`;

          return (
            <li
              className={`group relative flex h-16 w-[13.5rem] min-w-0 items-center gap-2.5 rounded-lg border px-2.5 pr-14 transition-colors ${
                isFailed
                  ? 'border-red-400/35 bg-red-500/[0.07]'
                  : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
              }`}
              data-composer-attachment-status={attachment.status}
              key={attachment.id}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.045]">
                {attachment.kind === 'image' && attachment.previewUrl ? (
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                    src={attachment.previewUrl}
                  />
                ) : (
                  <AttachmentIcon
                    aria-hidden="true"
                    className={isFailed ? 'text-red-300' : 'text-zinc-300'}
                    size={19}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium leading-5 text-zinc-100" title={attachment.displayName}>
                  {attachment.displayName}
                </div>
                <div
                  className={`flex min-w-0 items-center gap-1 truncate text-[10px] leading-4 ${
                    isFailed ? 'text-red-300' : 'text-zinc-500'
                  }`}
                >
                  {isUploading ? <Loader2 aria-hidden="true" className="shrink-0 animate-spin" size={10} /> : null}
                  <span className="truncate">{statusText}</span>
                </div>
              </div>

              <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
                {isFailed ? (
                  <button
                    type="button"
                    aria-label={`${t('chat.retryAttachment')}: ${attachment.displayName}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-red-300 transition-colors hover:bg-red-400/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={disabled}
                    onClick={() => onRetry(attachment.id)}
                    title={t('chat.retryAttachment')}
                  >
                    <RotateCw aria-hidden="true" size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`${t('chat.removeAttachment')}: ${attachment.displayName}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 opacity-80 transition-colors hover:bg-white/10 hover:text-white group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={disabled}
                  onClick={() => onRemove(attachment.id)}
                  title={t('chat.removeAttachment')}
                >
                  <X aria-hidden="true" size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
});

ComposerAttachmentTray.displayName = 'ComposerAttachmentTray';
