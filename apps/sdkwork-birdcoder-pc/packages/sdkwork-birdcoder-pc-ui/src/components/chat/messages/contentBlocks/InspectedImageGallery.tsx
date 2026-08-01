import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';
import {
  resolveAgentSessionItemMediaSource,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentSessionItemResourceView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';

interface InspectedImageGalleryProps {
  context: ChatMessageRenderContext;
  images: readonly AgentSessionItemResourceView[];
}

interface ResolvedInspectedImage {
  id: string;
  path: string;
  source: string;
}

function resolveImagePath(image: AgentSessionItemResourceView): string {
  return image.path?.trim() || image.origin?.path?.trim() || '';
}

function resolveInlineImageSource(image: AgentSessionItemResourceView): string | undefined {
  return resolveAgentSessionItemMediaSource(
    image.mediaSource,
    'image',
    image.mimeType,
  );
}

function ImagePreviewDialog({
  closeLabel,
  imageAlt,
  images,
  initialIndex,
  nextLabel,
  onClose,
  previousLabel,
}: {
  closeLabel: string;
  imageAlt: string;
  images: readonly ResolvedInspectedImage[];
  initialIndex: number;
  nextLabel: string;
  onClose: () => void;
  previousLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const selectedImage = images[selectedIndex];
  const canNavigate = images.length > 1;
  const showPrevious = useCallback(() => {
    setSelectedIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);
  const showNext = useCallback(() => {
    setSelectedIndex((index) => (index + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && canNavigate) {
        showPrevious();
      } else if (event.key === 'ArrowRight' && canNavigate) {
        showNext();
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
  }, [canNavigate, onClose, showNext, showPrevious]);

  if (typeof document === 'undefined' || !selectedImage) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
      data-chat-inspected-image-dialog="true"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <img
        src={selectedImage.source}
        alt={imageAlt}
        className="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-5rem)] object-contain"
      />
      {canNavigate ? (
        <>
          <button
            type="button"
            className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-md bg-black/55 text-gray-200 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
            title={previousLabel}
            aria-label={previousLabel}
            onClick={showPrevious}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-md bg-black/55 text-gray-200 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
            title={nextLabel}
            aria-label={nextLabel}
            onClick={showNext}
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          <span className="absolute bottom-4 rounded bg-black/60 px-2 py-1 text-xs tabular-nums text-gray-300">
            {selectedIndex + 1} / {images.length}
          </span>
        </>
      ) : null}
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

export const InspectedImageGallery = memo(function InspectedImageGallery({
  context,
  images,
}: InspectedImageGalleryProps) {
  const [resolvedSources, setResolvedSources] = useState<ReadonlyMap<string, string>>(() => (
    new Map(images.flatMap((image) => {
      const source = resolveInlineImageSource(image);
      return source ? [[image.id, source] as const] : [];
    }))
  ));
  const [pendingImageIds, setPendingImageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const sourceIdentity = context.allMessages[context.index]?.id.trim()
    || String(context.index);
  const disclosureKey = useMemo(
    () => `${context.sessionId}\u0001${sourceIdentity}\u0001inspected-images:${images
      .map((image) => image.id)
      .join(',')}`,
    [context.sessionId, images, sourceIdentity],
  );
  const isExpanded = context.expandedDisclosureKeys.has(disclosureKey);
  const resolveLocalPreview = context.environment?.resolveLocalImagePreviewUrl;

  useEffect(() => {
    let isCurrent = true;
    const inlineSources = new Map<string, string>();
    images.forEach((image) => {
      const source = resolveInlineImageSource(image);
      if (source) inlineSources.set(image.id, source);
    });
    setResolvedSources(inlineSources);
    if (!resolveLocalPreview) {
      setPendingImageIds(new Set());
      return () => {
        isCurrent = false;
      };
    }

    const pendingImages = images.filter((image) => (
      !inlineSources.has(image.id) && Boolean(resolveImagePath(image))
    ));
    setPendingImageIds(new Set(pendingImages.map((image) => image.id)));
    void Promise.all(pendingImages.map((image) => {
      const path = resolveImagePath(image);
      return resolveLocalPreview(path)
        .then((candidate) => {
          const source = resolveAgentSessionItemMediaSource(candidate, 'image', image.mimeType);
          return source ? ([image.id, source] as const) : null;
        })
        .catch(() => null);
    })).then((entries) => {
      if (!isCurrent) return;
      const nextSources = new Map(inlineSources);
      entries.forEach((entry) => {
        if (entry) nextSources.set(entry[0], entry[1]);
      });
      setResolvedSources(nextSources);
      setPendingImageIds(new Set());
    });
    return () => {
      isCurrent = false;
    };
  }, [images, resolveLocalPreview]);

  const resolvedImages = useMemo<ResolvedInspectedImage[]>(() => images.flatMap((image) => {
    const source = resolvedSources.get(image.id);
    const path = resolveImagePath(image);
    return source && path ? [{ id: image.id, path, source }] : [];
  }), [images, resolvedSources]);
  const previewIndex = previewImageId
    ? resolvedImages.findIndex((image) => image.id === previewImageId)
    : -1;
  const count = images.length;
  const viewedLabel = context.environment?.t('chat.viewedImagesSummary', { count })
    ?? (count === 1 ? 'Viewed an image' : `Viewed ${count} images`);
  const expandLabel = context.environment?.t('chat.viewedImagesExpand')
    ?? 'Show inspected images';
  const collapseLabel = context.environment?.t('chat.viewedImagesCollapse')
    ?? 'Hide inspected images';
  const previewLabel = context.environment?.t('chat.previewImage') ?? 'Preview image';
  const closeLabel = context.environment?.t('chat.closeImagePreview') ?? 'Close image preview';
  const imageAlt = context.environment?.t('chat.inspectedImageAlt') ?? 'Inspected image';
  const previousLabel = context.environment?.t('chat.previousInspectedImage') ?? 'Previous image';
  const nextLabel = context.environment?.t('chat.nextInspectedImage') ?? 'Next image';

  return (
    <section className="min-w-0" data-chat-inspected-images="true">
      <button
        type="button"
        className="flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md py-1 text-left text-gray-400 transition-colors hover:bg-white/[0.035] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        aria-expanded={isExpanded}
        aria-label={`${viewedLabel}. ${isExpanded ? collapseLabel : expandLabel}`}
        title={isExpanded ? collapseLabel : expandLabel}
        onClick={() => context.toggleDisclosure(disclosureKey)}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
          <ImageIcon size={14} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-300">
          {viewedLabel}
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-600">
          {isExpanded
            ? <ChevronUp size={14} aria-hidden="true" />
            : <ChevronDown size={14} aria-hidden="true" />}
        </span>
      </button>

      {isExpanded ? (
        <ul
          className="custom-scrollbar flex max-w-full snap-x gap-2 overflow-x-auto pb-1 pt-2"
          aria-label={viewedLabel}
          data-chat-inspected-image-thumbnails="true"
        >
          {images.map((image) => {
            const path = resolveImagePath(image);
            const source = resolvedSources.get(image.id);
            const canOpenFile = Boolean(path && context.environment?.onOpenFile);
            return (
              <li key={image.id} className="h-20 w-20 shrink-0 snap-start">
                <button
                  type="button"
                  className="group relative h-20 w-20 overflow-hidden rounded-md border border-white/10 bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 disabled:cursor-default"
                  aria-label={`${previewLabel}: ${path}`}
                  title={path}
                  disabled={!source && !canOpenFile}
                  onClick={() => {
                    if (source) {
                      setPreviewImageId(image.id);
                    } else if (path) {
                      context.environment?.onOpenFile?.(path);
                    }
                  }}
                >
                  {source ? (
                    <img
                      src={source}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.025]"
                      loading="lazy"
                    />
                  ) : pendingImageIds.has(image.id) ? (
                    <Loader2
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-gray-500"
                      size={17}
                      aria-hidden="true"
                    />
                  ) : (
                    <ImageIcon
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {previewIndex >= 0 ? (
        <ImagePreviewDialog
          closeLabel={closeLabel}
          imageAlt={imageAlt}
          images={resolvedImages}
          initialIndex={previewIndex}
          nextLabel={nextLabel}
          onClose={() => setPreviewImageId(null)}
          previousLabel={previousLabel}
        />
      ) : null}
    </section>
  );
});
