import React, { memo } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
  Copy,
  ExternalLink,
  FileText,
  FileWarning,
  Link2,
} from 'lucide-react';
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  buildChatContentPreview,
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
} from '../contentPreview.ts';
import type { ChatMessageTranslate } from '../types.ts';

type ToolResultBlock = NonNullable<ChatMessageToolCall['resultBlocks']>[number];

export interface ToolResultBlocksProps {
  blocks: readonly ToolResultBlock[];
  compact: boolean;
  copyMessageToClipboard: (content: string) => void;
  kind?: ChatMessageToolCall['kind'];
  status?: ChatMessageToolCall['status'];
  t?: ChatMessageTranslate;
}

const MAX_VISIBLE_RESULT_LIST_ITEMS = 100;
const MAX_VISIBLE_RESULT_BLOCKS = 24;
const MAX_RICH_RESULT_GROUP_CHARACTERS = 48_000;
const MAX_EXTERNAL_URL_CHARACTERS = 4_096;
const MAX_RESULT_METADATA_CHARACTERS = 2_000;

interface VisibleResultBlock {
  block: ToolResultBlock;
  hasGapBefore: boolean;
  sourceIndex: number;
}

function selectVisibleResultBlocks(
  blocks: readonly ToolResultBlock[],
): VisibleResultBlock[] {
  if (blocks.length <= MAX_VISIBLE_RESULT_BLOCKS) {
    return blocks.map((block, sourceIndex) => ({
      block,
      hasGapBefore: false,
      sourceIndex,
    }));
  }

  const tailCount = Math.max(1, Math.floor(MAX_VISIBLE_RESULT_BLOCKS / 4));
  const headCount = MAX_VISIBLE_RESULT_BLOCKS - tailCount;
  return [
    ...blocks.slice(0, headCount).map((block, sourceIndex) => ({
      block,
      hasGapBefore: false,
      sourceIndex,
    })),
    ...blocks.slice(-tailCount).map((block, tailIndex) => ({
      block,
      hasGapBefore: tailIndex === 0,
      sourceIndex: blocks.length - tailCount + tailIndex,
    })),
  ];
}

interface BoundedResultListItems {
  isCharacterTruncated: boolean;
  items: string[];
}

type TaskResultItemState = 'blocked' | 'cancelled' | 'completed' | 'pending' | 'running';

interface TaskResultItem {
  state: TaskResultItemState;
  text: string;
}

function parseTaskResultItem(item: string): TaskResultItem | null {
  const match = /^\[([x~!\- ])\]\s*(.+)$/u.exec(item.trim());
  if (!match) {
    return null;
  }
  const stateByMarker: Readonly<Record<string, TaskResultItemState>> = {
    '!': 'blocked',
    '-': 'cancelled',
    ' ': 'pending',
    '~': 'running',
    x: 'completed',
  };
  return {
    state: stateByMarker[match[1] ?? ' '] ?? 'pending',
    text: match[2] ?? '',
  };
}

function resolveTaskResultItemStateLabel(
  state: TaskResultItemState,
  t?: ChatMessageTranslate,
): string {
  const labels: Readonly<Record<TaskResultItemState, string>> = {
    blocked: t?.('chat.taskItemBlocked') ?? 'Blocked',
    cancelled: t?.('chat.taskItemCancelled') ?? 'Cancelled',
    completed: t?.('chat.taskItemCompleted') ?? 'Completed',
    pending: t?.('chat.taskItemPending') ?? 'Pending',
    running: t?.('chat.taskItemRunning') ?? 'In progress',
  };
  return labels[state];
}

function renderTaskResultItemIcon(state: TaskResultItemState) {
  if (state === 'completed') {
    return <CheckCircle2 size={12} className="shrink-0 text-emerald-400/80" aria-hidden="true" />;
  }
  if (state === 'running') {
    return <CircleDashed size={12} className="shrink-0 text-blue-300" aria-hidden="true" />;
  }
  if (state === 'blocked') {
    return <AlertCircle size={12} className="shrink-0 text-amber-300" aria-hidden="true" />;
  }
  if (state === 'cancelled') {
    return <Ban size={12} className="shrink-0 text-gray-400" aria-hidden="true" />;
  }
  return <Circle size={12} className="shrink-0 text-gray-500" aria-hidden="true" />;
}

function buildBoundedResultListItems(
  items: readonly string[],
  maxCharacters: number,
): BoundedResultListItems {
  const visibleItems: string[] = [];
  let consumedCharacters = 0;

  for (const item of items.slice(0, MAX_VISIBLE_RESULT_LIST_ITEMS)) {
    const separatorCharacters = visibleItems.length > 0 ? 1 : 0;
    const availableCharacters = maxCharacters - consumedCharacters - separatorCharacters;
    if (availableCharacters <= 0) {
      return { isCharacterTruncated: true, items: visibleItems };
    }
    if (item.length > availableCharacters) {
      visibleItems.push(item.slice(0, availableCharacters));
      return { isCharacterTruncated: true, items: visibleItems };
    }

    visibleItems.push(item);
    consumedCharacters += separatorCharacters + item.length;
  }

  return {
    isCharacterTruncated: false,
    items: visibleItems,
  };
}

function joinSemanticResultParts(parts: readonly (string | undefined)[]): string {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => {
      if (!part || seen.has(part)) {
        return false;
      }
      seen.add(part);
      return true;
    })
    .join('\n');
}

function appendSemanticResultBody(header: string, body: string | undefined): string {
  if (!body || !/\S/u.test(body)) {
    return header;
  }
  return header ? `${header}\n\n${body}` : body;
}

export function resolveToolResultBlocksCopyContent(
  blocks: readonly ToolResultBlock[],
): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return block.text;
        case 'error':
          return block.message;
        case 'diff':
          return appendSemanticResultBody(
            joinSemanticResultParts([block.path]),
            block.content,
          );
        case 'list':
          return block.items.join('\n');
        case 'link':
          return joinSemanticResultParts([block.title, block.url, block.description]);
        case 'resource':
          return appendSemanticResultBody(
            joinSemanticResultParts([
              block.name,
              block.uri,
              block.mimeType,
              block.description,
            ]),
            block.text,
          );
        case 'image':
        case 'audio':
          return joinSemanticResultParts([block.title, block.source, block.mimeType]);
      }
    })
    .filter((content) => /\S/u.test(content))
    .join('\n\n');
}

function isSafeExternalUrl(value: string): boolean {
  return value.length <= MAX_EXTERNAL_URL_CHARACTERS && /^https?:\/\//iu.test(value);
}

function isSafeMediaSource(value: string, kind: 'audio' | 'image'): boolean {
  return isSafeExternalUrl(value)
    || value.startsWith('blob:')
    || value.startsWith(`data:${kind}/`);
}

function formatResourceSize(size: number | undefined): string {
  if (size === undefined || !Number.isFinite(size) || size < 0) {
    return '';
  }
  if (size < 1_024) {
    return `${Math.round(size)} B`;
  }
  if (size < 1_048_576) {
    return `${(size / 1_024).toFixed(size < 10_240 ? 1 : 0)} KB`;
  }
  return `${(size / 1_048_576).toFixed(size < 10_485_760 ? 1 : 0)} MB`;
}

function renderTruncatedNotice(
  key: string,
  isTruncated: boolean,
  fullContent: string | (() => string),
  copyMessageToClipboard: (content: string) => void,
  t?: ChatMessageTranslate,
) {
  const copyLabel = t?.('chat.toolCopyOutput') ?? 'Copy tool output';
  return isTruncated ? (
    <div key={key} className="flex min-w-0 items-center gap-2 pt-1 text-[10px] text-gray-400/80">
      <span className="min-w-0 flex-1 break-words">
        {t?.('chat.toolDetailTruncated') ?? 'Preview truncated. Copy to inspect the full content.'}
      </span>
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        title={copyLabel}
        aria-label={copyLabel}
        onClick={() => copyMessageToClipboard(
          typeof fullContent === 'function' ? fullContent() : fullContent,
        )}
      >
        <Copy size={11} aria-hidden="true" />
      </button>
    </div>
  ) : null;
}

function renderUnavailableMedia(
  block: Extract<ToolResultBlock, { type: 'audio' | 'image' }>,
  key: string,
  copyMessageToClipboard: (content: string) => void,
  t?: ChatMessageTranslate,
) {
  const label = block.title?.trim()
    || block.mimeType?.trim()
    || (t?.('chat.toolResultPreviewUnavailable') ?? 'Preview unavailable');
  const labelPreview = buildChatContentPreview(label, {
    maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
    tailCharacters: 0,
  });
  const sourcePreview = buildChatContentPreview(block.source, {
    maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
    tailCharacters: 500,
  });
  const copyLabel = t?.('chat.toolCopyResourceUri') ?? 'Copy resource URI';
  return (
    <div key={key} className="flex min-w-0 items-center gap-2 rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px]">
      <FileWarning size={13} className="shrink-0 text-amber-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-gray-300">{labelPreview.text}</div>
        <div className="truncate font-mono text-[10px] text-gray-400/80">
          {sourcePreview.text}
        </div>
      </div>
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        title={copyLabel}
        aria-label={copyLabel}
        onClick={() => copyMessageToClipboard(block.source)}
      >
        <Copy size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

function renderToolResultBlock(
  block: ToolResultBlock,
  index: number,
  compact: boolean,
  copyMessageToClipboard: (content: string) => void,
  kind: ChatMessageToolCall['kind'],
  previewCharacterLimit: number,
  status: ChatMessageToolCall['status'],
  t?: ChatMessageTranslate,
) {
  const key = `${block.type}:${index}`;
  const outputRegionLabel = t?.('chat.toolOutput') ?? 'Output';
  if (block.type === 'text') {
    const preview = buildChatContentPreview(block.text, {
      maxCharacters: previewCharacterLimit,
    });
    return (
      <div key={key}>
        <pre
          className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}
          role="region"
          aria-label={outputRegionLabel}
          tabIndex={0}
        >
          {preview.text}
        </pre>
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, block.text, copyMessageToClipboard, t)}
      </div>
    );
  }
  if (block.type === 'error') {
    const preview = buildChatContentPreview(block.message, {
      maxCharacters: previewCharacterLimit,
    });
    const isCancelled = status === 'cancelled';
    const statusLabel = t?.('chat.toolStatusCancelled') ?? 'Cancelled';
    return (
      <div key={key}>
        <div
          className={`flex items-start gap-2 overflow-auto rounded-md px-2 py-2 text-[11px] custom-scrollbar ${
            isCancelled
              ? 'bg-white/[0.035] text-gray-300'
              : 'bg-red-500/10 text-red-200'
          } ${compact ? 'max-h-40' : 'max-h-64'}`}
          data-chat-tool-result-tone={isCancelled ? 'cancelled' : 'error'}
          role={isCancelled ? 'region' : 'alert'}
          aria-label={isCancelled ? statusLabel : undefined}
          tabIndex={0}
        >
          {isCancelled ? (
            <Ban size={13} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
          ) : (
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 whitespace-pre-wrap break-words">{preview.text}</span>
        </div>
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, block.message, copyMessageToClipboard, t)}
      </div>
    );
  }
  if (block.type === 'link') {
    const label = block.title?.trim() || block.url;
    const labelPreview = buildChatContentPreview(label, {
      maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
      tailCharacters: 0,
    });
    const descriptionPreview = block.description
      ? buildChatContentPreview(block.description, {
          maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
          tailCharacters: 500,
        })
      : null;
    const isExternalUrl = isSafeExternalUrl(block.url);
    const copyLabel = t?.('chat.toolCopyResourceUri') ?? 'Copy resource URI';
    return (
      <div key={key} className="flex min-w-0 items-start gap-2 rounded-md bg-white/[0.025] px-2 py-2 text-[11px]">
        <Link2 size={13} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {isExternalUrl ? (
            <a
              className="inline-flex min-w-0 max-w-full items-center gap-1 text-sky-200 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              href={block.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              <span className="truncate">{labelPreview.text}</span>
              <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <span className="break-all text-gray-300">{labelPreview.text}</span>
          )}
          {descriptionPreview?.text ? (
            <div className="mt-0.5 line-clamp-2 text-gray-400/80">
              {descriptionPreview.text}
            </div>
          ) : null}
        </div>
        {!isExternalUrl ? (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={copyLabel}
            aria-label={copyLabel}
            onClick={() => copyMessageToClipboard(block.url)}
          >
            <Copy size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }
  if (block.type === 'resource') {
    const resourceLabel = block.name?.trim() || block.uri;
    const resourceLabelPreview = buildChatContentPreview(resourceLabel, {
      maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
      tailCharacters: 0,
    });
    const resourceUriPreview = buildChatContentPreview(block.uri, {
      maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
      tailCharacters: 500,
    });
    const descriptionPreview = block.description
      ? buildChatContentPreview(block.description, {
          maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
          tailCharacters: 500,
        })
      : null;
    const resourceSize = formatResourceSize(block.size);
    const resourceUriLabel = t?.('chat.toolResultResourceUri') ?? 'Resource URI';
    const copyLabel = t?.('chat.toolCopyResourceUri') ?? 'Copy resource URI';
    const textPreview = block.text
      ? buildChatContentPreview(block.text, {
          maxCharacters: previewCharacterLimit,
        })
      : null;
    return (
      <div key={key} className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2 text-gray-300">
          <FileText size={13} className="shrink-0 text-violet-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={resourceLabel}>{resourceLabelPreview.text}</span>
          {block.mimeType ? (
            <span
              className={`max-w-32 shrink-0 truncate text-[10px] text-gray-400/80 max-[760px]:hidden ${compact ? 'hidden' : ''}`}
              title={block.mimeType.slice(0, 256)}
            >
              {block.mimeType.slice(0, 256)}
            </span>
          ) : null}
          {resourceSize ? (
            <span className={`shrink-0 text-[10px] text-gray-400/80 max-[760px]:hidden ${compact ? 'hidden' : ''}`}>
              {resourceSize}
            </span>
          ) : null}
        </div>
        {descriptionPreview?.text ? (
          <div
            className="mt-1 line-clamp-2 text-[10px] text-gray-400/80 [overflow-wrap:anywhere]"
            title={block.description}
          >
            {descriptionPreview.text}
          </div>
        ) : null}
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] text-gray-400/80">{resourceUriLabel}</span>
          {isSafeExternalUrl(block.uri) ? (
            <a
              className="min-w-0 flex-1 truncate font-mono text-[10px] text-sky-200 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              href={block.uri}
              rel="noreferrer noopener"
              target="_blank"
              title={block.uri.length <= MAX_EXTERNAL_URL_CHARACTERS ? block.uri : undefined}
            >
              {resourceUriPreview.text}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-300">
              {resourceUriPreview.text}
            </span>
          )}
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={copyLabel}
            aria-label={copyLabel}
            onClick={() => copyMessageToClipboard(block.uri)}
          >
            <Copy size={12} aria-hidden="true" />
          </button>
        </div>
        {textPreview ? (
          <>
            <pre
              className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-gray-300 custom-scrollbar"
              role="region"
              aria-label={outputRegionLabel}
              tabIndex={0}
            >
              {textPreview.text}
            </pre>
            {renderTruncatedNotice(`${key}:truncated`, textPreview.isTruncated, block.text ?? '', copyMessageToClipboard, t)}
          </>
        ) : null}
      </div>
    );
  }
  if (block.type === 'image') {
    const imageTitle = block.title
      ? buildChatContentPreview(block.title, {
          maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
          tailCharacters: 0,
        }).text
      : '';
    return isSafeMediaSource(block.source, 'image') ? (
      <figure key={key} className="overflow-hidden rounded-md bg-black/20 p-2">
        <img
          src={block.source}
          alt={imageTitle.trim() || t?.('chat.toolResultImage') || 'Tool result image'}
          className="max-h-80 max-w-full object-contain"
          loading="lazy"
        />
        {imageTitle ? (
          <figcaption
            className="line-clamp-2 pt-1 text-[10px] text-gray-400/80 [overflow-wrap:anywhere]"
            title={block.title}
          >
            {imageTitle}
          </figcaption>
        ) : null}
      </figure>
    ) : renderUnavailableMedia(block, key, copyMessageToClipboard, t);
  }
  if (block.type === 'audio') {
    const audioTitle = block.title
      ? buildChatContentPreview(block.title, {
          maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
          tailCharacters: 0,
        }).text
      : '';
    return isSafeMediaSource(block.source, 'audio') ? (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {audioTitle ? (
          <div
            className="mb-1 line-clamp-2 text-[10px] text-gray-400/80 [overflow-wrap:anywhere]"
            title={block.title}
          >
            {audioTitle}
          </div>
        ) : null}
        <audio
          controls
          preload="metadata"
          className="h-9 w-full min-w-0 max-w-full"
          src={block.source}
          aria-label={audioTitle.trim() || outputRegionLabel}
        >
          {t?.('chat.toolResultAudioUnsupported') ?? 'Audio playback is not supported.'}
        </audio>
      </div>
    ) : renderUnavailableMedia(block, key, copyMessageToClipboard, t);
  }
  if (block.type === 'diff') {
    const preview = buildChatContentPreview(block.content, {
      maxCharacters: previewCharacterLimit,
    });
    return (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {block.path ? (
          <div className="mb-1 truncate font-mono text-[10px] text-gray-400/80">
            {buildChatContentPreview(block.path, {
              maxCharacters: MAX_RESULT_METADATA_CHARACTERS,
              tailCharacters: 500,
            }).text}
          </div>
        ) : null}
        <pre
          className={`overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-300 custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}
          role="region"
          aria-label={outputRegionLabel}
          tabIndex={0}
        >
          {preview.text}
        </pre>
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, block.content, copyMessageToClipboard, t)}
      </div>
    );
  }

  const boundedItems = buildBoundedResultListItems(
    block.items,
    previewCharacterLimit,
  );
  const visibleItems = boundedItems.items;
  const totalItems = Math.max(block.totalItems ?? block.items.length, block.items.length);
  const omittedItemCount = Math.max(0, totalItems - visibleItems.length);
  if (visibleItems.length === 0) {
    return (
      <div
        key={key}
        className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500"
        data-chat-tool-result-empty="true"
      >
        {t?.('chat.toolResultEmpty') ?? 'No results returned.'}
      </div>
    );
  }

  const parsedTaskItems = kind === 'task'
    ? visibleItems.map(parseTaskResultItem)
    : [];
  const taskItems = parsedTaskItems.filter(
    (item): item is TaskResultItem => item !== null,
  );
  const isTaskResultList = taskItems.length > 0
    && taskItems.length === parsedTaskItems.length;

  return (
    <div key={key}>
      <div
        className="max-h-56 overflow-auto rounded-md bg-black/20 custom-scrollbar"
        data-chat-task-result-list={isTaskResultList ? 'true' : undefined}
        role="region"
        aria-label={outputRegionLabel}
        tabIndex={0}
      >
        <ul className={isTaskResultList
          ? 'space-y-1 px-2 py-2 text-[11px] text-gray-300'
          : 'list-disc space-y-0.5 py-2 pl-7 pr-2 text-[11px] text-gray-300'}>
          {isTaskResultList
            ? taskItems.map((item, itemIndex) => (
                <li key={`${key}:task-item:${itemIndex}`} className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5">{renderTaskResultItemIcon(item.state)}</span>
                  <span className="min-w-0 break-words">
                    <span className="sr-only">
                      {resolveTaskResultItemStateLabel(item.state, t)}:{' '}
                    </span>
                    {item.text}
                  </span>
                </li>
              ))
            : visibleItems.map((item, itemIndex) => (
                <li key={`${key}:item:${itemIndex}`} className="break-words">{item}</li>
              ))}
        </ul>
      </div>
      {omittedItemCount > 0 ? (
        <div className="pt-1 text-[10px] text-gray-400/80">
          {t?.('chat.toolResultItemsOmitted', { count: omittedItemCount })
            ?? `${omittedItemCount} additional items omitted from the preview.`}
        </div>
      ) : null}
      {renderTruncatedNotice(
        `${key}:characters-truncated`,
        boundedItems.isCharacterTruncated,
        () => block.items.join('\n'),
        copyMessageToClipboard,
        t,
      )}
    </div>
  );
}

export const ToolResultBlocks = memo(function ToolResultBlocks({
  blocks,
  compact,
  copyMessageToClipboard,
  kind,
  status,
  t,
}: ToolResultBlocksProps) {
  const visibleBlocks = selectVisibleResultBlocks(blocks);
  const previewCharacterLimit = Math.min(
    MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
    Math.max(
      1,
      Math.floor(
        MAX_RICH_RESULT_GROUP_CHARACTERS / Math.max(1, visibleBlocks.length),
      ),
    ),
  );
  return (
    <div className="space-y-1.5" data-chat-tool-result-blocks="true">
      {visibleBlocks.map((entry) => (
        <React.Fragment key={`result-block:${entry.sourceIndex}`}>
          {entry.hasGapBefore
            ? renderTruncatedNotice(
                'result-blocks:truncated',
                true,
                () => resolveToolResultBlocksCopyContent(blocks),
                copyMessageToClipboard,
                t,
              )
            : null}
          {renderToolResultBlock(
            entry.block,
            entry.sourceIndex,
            compact,
            copyMessageToClipboard,
            kind,
            previewCharacterLimit,
            status,
            t,
          )}
        </React.Fragment>
      ))}
    </div>
  );
});
