import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AudioLines,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  X,
} from 'lucide-react';
import type { ChatMessageRenderContext } from './types.ts';
import type {
  UserMessageAudioAttachment,
  UserMessageFileAttachment,
  UserMessageImageAttachment,
} from './userMessageDisplay.ts';

const FILE_ICON_BY_KIND = {
  audio: AudioLines,
  citation: Link2,
  file: FileText,
  image: ImageIcon,
  mention: Link2,
  skill: Link2,
  uri: Link2,
} as const;

interface UserMessageAttachmentsProps {
  audios?: readonly UserMessageAudioAttachment[];
  context: ChatMessageRenderContext;
  files: readonly UserMessageFileAttachment[];
  images: readonly UserMessageImageAttachment[];
}

type ResolvedUserMessageImageAttachment = UserMessageImageAttachment & { source: string };

function useResolvedDriveAttachmentSource({
  driveNodeId,
  resolvePreview,
  source,
}: {
  driveNodeId?: string;
  resolvePreview?: (nodeId: string) => Promise<string | undefined>;
  source?: string;
}): { resolutionFailed: boolean; resolvedSource?: string } {
  const [resolvedSource, setResolvedSource] = useState(source);
  const [resolutionFailed, setResolutionFailed] = useState(false);

  useEffect(() => {
    setResolvedSource(source);
    setResolutionFailed(false);
    if (source) {
      return undefined;
    }
    if (!driveNodeId || !resolvePreview) {
      setResolutionFailed(true);
      return undefined;
    }

    let isCurrent = true;
    void resolvePreview(driveNodeId).then((nextSource) => {
      if (!isCurrent) {
        return;
      }
      if (nextSource) {
        setResolvedSource(nextSource);
      } else {
        setResolutionFailed(true);
      }
    }).catch(() => {
      if (isCurrent) {
        setResolutionFailed(true);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [driveNodeId, resolvePreview, source]);

  return { resolutionFailed, resolvedSource };
}

function UserMessageAudioItem({
  audio,
  context,
}: {
  audio: UserMessageAudioAttachment;
  context: ChatMessageRenderContext;
}) {
  const { resolutionFailed, resolvedSource } = useResolvedDriveAttachmentSource({
    driveNodeId: audio.driveNodeId,
    resolvePreview: context.environment?.resolveDriveAttachmentPreviewUrl,
    source: audio.source,
  });
  const canOpenDriveAttachment = Boolean(
    audio.driveNodeId && context.environment?.onOpenDriveAttachment,
  );
  const previewFileLabel = context.environment?.t('chat.previewFile') ?? 'Preview file';

  return (
    <li
      className="min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.035] p-2.5"
      data-chat-user-audio="true"
      data-chat-user-audio-resolved={resolvedSource ? 'true' : 'false'}
    >
      <span className="mb-2 flex min-w-0 items-center gap-2 text-[12px] font-medium leading-4 text-gray-200">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-gray-400">
          <AudioLines size={14} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate" title={audio.title}>{audio.title}</span>
      </span>
      {resolvedSource ? (
        <audio
          className="h-8 w-full min-w-0 [color-scheme:dark]"
          controls
          preload="metadata"
          src={resolvedSource}
          aria-label={audio.title}
        />
      ) : resolutionFailed ? (
        <button
          type="button"
          className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-white/[0.045] text-xs text-gray-400 transition-colors enabled:hover:bg-white/[0.075] enabled:hover:text-gray-200 disabled:cursor-default"
          disabled={!canOpenDriveAttachment}
          aria-label={`${previewFileLabel}: ${audio.title}`}
          onClick={() => {
            if (audio.driveNodeId) {
              context.environment?.onOpenDriveAttachment?.(audio.driveNodeId, audio.title);
            }
          }}
        >
          <ExternalLink size={13} aria-hidden="true" />
          <span className="truncate">{audio.title}</span>
        </button>
      ) : (
        <span
          className="flex h-8 w-full items-center justify-center text-gray-500"
          role="status"
        >
          <Loader2 aria-hidden="true" className="animate-spin" size={16} />
        </span>
      )}
    </li>
  );
}

function UserMessageAudioList({
  audios,
  context,
}: {
  audios: readonly UserMessageAudioAttachment[];
  context: ChatMessageRenderContext;
}) {
  if (audios.length === 0) {
    return null;
  }
  const resourcesLabel = context.environment?.t('chat.messageResources') ?? 'Message resources';
  return (
    <ul
      className="flex w-[min(22rem,78vw)] min-w-0 flex-col items-stretch gap-1.5"
      aria-label={resourcesLabel}
      data-chat-user-audio-list="true"
    >
      {audios.map((audio) => (
        <UserMessageAudioItem audio={audio} context={context} key={audio.id} />
      ))}
    </ul>
  );
}

function ImagePreviewDialog({
  image,
  onClose,
  closeLabel,
}: {
  closeLabel: string;
  image: ResolvedUserMessageImageAttachment;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      window.requestAnimationFrame(() => {
        if (previouslyFocusedElement?.isConnected) {
          previouslyFocusedElement.focus();
        }
      });
    };
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      data-chat-image-preview-dialog="true"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <img
        src={image.source}
        alt={image.title}
        className="max-h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] object-contain"
      />
      <button
        ref={closeButtonRef}
        type="button"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md bg-black/55 text-gray-200 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
        title={closeLabel}
        aria-label={closeLabel}
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

function UserMessageImageButton({
  context,
  image,
  isSingleImage,
  onPreview,
}: {
  context: ChatMessageRenderContext;
  image: UserMessageImageAttachment;
  isSingleImage: boolean;
  onPreview: (image: ResolvedUserMessageImageAttachment) => void;
}) {
  const previewLabel = context.environment?.t('chat.previewImage') ?? 'Preview image';
  const resolvePreview = context.environment?.resolveDriveAttachmentPreviewUrl;
  const { resolutionFailed: previewFailed, resolvedSource } =
    useResolvedDriveAttachmentSource({
      driveNodeId: image.driveNodeId,
      resolvePreview,
      source: image.source,
    });
  const canOpenDriveAttachment = Boolean(
    image.driveNodeId && context.environment?.onOpenDriveAttachment,
  );

  return (
    <li className={`min-w-0 ${isSingleImage ? 'aspect-[4/3]' : 'aspect-square'}`}>
      <button
        type="button"
        className="group/image relative h-full w-full min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black/25 text-left transition-colors enabled:hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 disabled:cursor-default"
        title={`${previewLabel}: ${image.title}`}
        aria-label={`${previewLabel}: ${image.title}`}
        data-chat-user-image="true"
        data-chat-user-image-resolved={resolvedSource ? 'true' : 'false'}
        disabled={!resolvedSource && !canOpenDriveAttachment}
        onClick={() => {
          if (resolvedSource) {
            onPreview({ ...image, source: resolvedSource });
          } else if (image.driveNodeId) {
            context.environment?.onOpenDriveAttachment?.(image.driveNodeId, image.title);
          }
        }}
      >
        {resolvedSource ? (
          <img
            src={resolvedSource}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover/image:scale-[1.015]"
            loading="lazy"
          />
        ) : previewFailed ? (
          <span className="flex h-full w-full items-center justify-center text-gray-500">
            <ImageIcon aria-hidden="true" size={20} />
          </span>
        ) : (
          <span className="flex h-full w-full items-center justify-center text-gray-500" role="status">
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
          </span>
        )}
      </button>
    </li>
  );
}

function UserMessageImageGrid({
  context,
  images,
}: {
  context: ChatMessageRenderContext;
  images: readonly UserMessageImageAttachment[];
}) {
  const [previewImage, setPreviewImage] = useState<ResolvedUserMessageImageAttachment | null>(null);
  const closePreview = useCallback(() => setPreviewImage(null), []);
  if (images.length === 0) {
    return null;
  }
  const imageGroupLabel = context.environment?.t('chat.messageImages') ?? 'Message images';
  const closeLabel = context.environment?.t('chat.closeImagePreview') ?? 'Close image preview';
  const isSingleImage = images.length === 1;

  return (
    <>
      <ul
        className={`grid min-w-0 gap-1.5 ${
          isSingleImage
            ? 'w-[min(18rem,72vw)] grid-cols-1'
            : 'w-[min(24rem,78vw)] grid-cols-2'
        }`}
        aria-label={imageGroupLabel}
        data-chat-user-image-grid="true"
      >
        {images.map((image) => (
          <UserMessageImageButton
            context={context}
            image={image}
            isSingleImage={isSingleImage}
            key={image.id}
            onPreview={setPreviewImage}
          />
        ))}
      </ul>
      {previewImage ? (
        <ImagePreviewDialog
          closeLabel={closeLabel}
          image={previewImage}
          onClose={closePreview}
        />
      ) : null}
    </>
  );
}

function FileAttachmentContent({
  attachment,
}: {
  attachment: UserMessageFileAttachment;
}) {
  const AttachmentIcon = FILE_ICON_BY_KIND[attachment.kind];
  const metadata = attachment.mimeType
    ?? (attachment.path ? attachment.path.split(/[\\/]/u).at(-1)?.split('.').at(-1)?.toUpperCase() : undefined)
    ?? attachment.kind;
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-gray-400">
        <AttachmentIcon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium leading-4 text-gray-200" title={attachment.title}>
          {attachment.title}
        </span>
        <span className="block truncate text-[10px] leading-4 text-gray-500" title={attachment.path ?? metadata}>
          {attachment.path ?? metadata}
        </span>
      </span>
      {attachment.externalUrl || attachment.driveNodeId ? (
        <ExternalLink size={13} className="shrink-0 text-gray-500" aria-hidden="true" />
      ) : null}
    </>
  );
}

function UserMessageFileList({
  context,
  files,
}: {
  context: ChatMessageRenderContext;
  files: readonly UserMessageFileAttachment[];
}) {
  if (files.length === 0) {
    return null;
  }
  const resourcesLabel = context.environment?.t('chat.messageResources') ?? 'Message resources';
  const openFileLabel = context.environment?.t('chat.openFileInEditor') ?? 'Open file in editor';
  const previewFileLabel = context.environment?.t('chat.previewFile') ?? 'Preview file';

  return (
    <ul
      className="flex w-[min(22rem,78vw)] min-w-0 flex-col items-stretch gap-1.5"
      aria-label={resourcesLabel}
      data-chat-user-file-list="true"
    >
      {files.map((attachment) => {
        const commonClassName = 'flex h-12 min-w-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70';
        const canOpenLocalFile = Boolean(attachment.path && context.environment?.onOpenFile);
        const canOpenDriveFile = Boolean(
          attachment.driveNodeId
          && context.environment?.onOpenDriveAttachment,
        );
        if (canOpenLocalFile) {
          return (
            <li className="min-w-0" key={attachment.id}>
              <button
                type="button"
                className={`${commonClassName} w-full`}
                title={`${openFileLabel}: ${attachment.path}`}
                aria-label={`${openFileLabel}: ${attachment.path}`}
                data-chat-user-file-attachment="true"
                onClick={() => context.environment?.onOpenFile?.(attachment.path!)}
              >
                <FileAttachmentContent attachment={attachment} />
              </button>
            </li>
          );
        }
        if (attachment.externalUrl) {
          return (
            <li className="min-w-0" key={attachment.id}>
              <a
                className={`${commonClassName} w-full`}
                href={attachment.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${previewFileLabel}: ${attachment.title}`}
                aria-label={`${previewFileLabel}: ${attachment.title}`}
                data-chat-user-file-attachment="true"
              >
                <FileAttachmentContent attachment={attachment} />
              </a>
            </li>
          );
        }
        if (canOpenDriveFile) {
          return (
            <li className="min-w-0" key={attachment.id}>
              <button
                type="button"
                className={`${commonClassName} w-full`}
                title={`${previewFileLabel}: ${attachment.title}`}
                aria-label={`${previewFileLabel}: ${attachment.title}`}
                data-chat-user-file-attachment="true"
                onClick={() => context.environment?.onOpenDriveAttachment?.(
                  attachment.driveNodeId!,
                  attachment.title,
                )}
              >
                <FileAttachmentContent attachment={attachment} />
              </button>
            </li>
          );
        }
        return (
          <li className="min-w-0" key={attachment.id}>
            <div
              className="flex h-12 min-w-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5"
              data-chat-user-file-attachment="true"
            >
              <FileAttachmentContent attachment={attachment} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const UserMessageAttachments = memo(function UserMessageAttachments({
  audios = [],
  context,
  files,
  images,
}: UserMessageAttachmentsProps) {
  if (images.length === 0 && audios.length === 0 && files.length === 0) {
    return null;
  }
  return (
    <div
      className="mb-2 flex max-w-full min-w-0 flex-col items-end gap-2"
      data-chat-user-attachments="true"
    >
      <UserMessageImageGrid context={context} images={images} />
      <UserMessageAudioList audios={audios} context={context} />
      <UserMessageFileList context={context} files={files} />
    </div>
  );
});
