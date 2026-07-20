import React, { memo } from 'react';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  FileText,
  FileWarning,
  Link2,
} from 'lucide-react';
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

type ToolResultBlock = NonNullable<ChatMessageToolCall['resultBlocks']>[number];

export interface ToolResultBlocksProps {
  blocks: readonly ToolResultBlock[];
  compact: boolean;
  copyMessageToClipboard: (content: string) => void;
  t?: ChatMessageTranslate;
}

const MAX_RICH_RESULT_TEXT_CHARACTERS = 24_000;
const MAX_VISIBLE_RESULT_LIST_ITEMS = 100;

function buildRichResultTextPreview(text: string): { isTruncated: boolean; text: string } {
  if (text.length <= MAX_RICH_RESULT_TEXT_CHARACTERS) {
    return { isTruncated: false, text };
  }
  const tailLength = 6_000;
  return {
    isTruncated: true,
    text: `${text.slice(0, MAX_RICH_RESULT_TEXT_CHARACTERS - tailLength)}\n\n...\n\n${text.slice(-tailLength)}`,
  };
}

function isSafeExternalUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
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
  t?: ChatMessageTranslate,
) {
  return isTruncated ? (
    <div key={key} className="pt-1 text-[10px] text-gray-400/80">
      {t?.('chat.toolDetailTruncated') ?? 'Preview truncated. Copy to inspect the full content.'}
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
  const copyLabel = t?.('chat.toolCopyResourceUri') ?? 'Copy resource URI';
  return (
    <div key={key} className="flex min-w-0 items-center gap-2 rounded-md bg-white/[0.025] px-2 py-1.5 text-[11px]">
      <FileWarning size={13} className="shrink-0 text-amber-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-gray-300">{label}</div>
        <div className="truncate font-mono text-[10px] text-gray-400/80" title={block.source}>
          {block.source}
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
  t?: ChatMessageTranslate,
) {
  const key = `${block.type}:${index}`;
  const outputRegionLabel = t?.('chat.toolOutput') ?? 'Output';
  if (block.type === 'text') {
    const preview = buildRichResultTextPreview(block.text);
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
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, t)}
      </div>
    );
  }
  if (block.type === 'error') {
    const preview = buildRichResultTextPreview(block.message);
    return (
      <div key={key}>
        <div className={`flex items-start gap-2 overflow-auto rounded-md bg-red-500/10 px-2 py-2 text-[11px] text-red-200 custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`} role="alert" tabIndex={0}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 whitespace-pre-wrap break-words">{preview.text}</span>
        </div>
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, t)}
      </div>
    );
  }
  if (block.type === 'link') {
    const label = block.title?.trim() || block.url;
    return (
      <div key={key} className="flex min-w-0 items-start gap-2 rounded-md bg-white/[0.025] px-2 py-2 text-[11px]">
        <Link2 size={13} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {isSafeExternalUrl(block.url) ? (
            <a
              className="inline-flex max-w-full items-center gap-1 text-sky-200 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              href={block.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              <span className="truncate">{label}</span>
              <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <span className="break-all text-gray-300">{label}</span>
          )}
          {block.description ? (
            <div className="mt-0.5 line-clamp-2 text-gray-400/80">{block.description}</div>
          ) : null}
        </div>
      </div>
    );
  }
  if (block.type === 'resource') {
    const resourceLabel = block.name?.trim() || block.uri;
    const resourceSize = formatResourceSize(block.size);
    const resourceUriLabel = t?.('chat.toolResultResourceUri') ?? 'Resource URI';
    const copyLabel = t?.('chat.toolCopyResourceUri') ?? 'Copy resource URI';
    const textPreview = block.text ? buildRichResultTextPreview(block.text) : null;
    return (
      <div key={key} className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2 text-gray-300">
          <FileText size={13} className="shrink-0 text-violet-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{resourceLabel}</span>
          {block.mimeType ? <span className="shrink-0 text-[10px] text-gray-400/80">{block.mimeType}</span> : null}
          {resourceSize ? <span className="shrink-0 text-[10px] text-gray-400/80">{resourceSize}</span> : null}
        </div>
        {block.description ? (
          <div className="mt-1 text-[10px] text-gray-400/80">{block.description}</div>
        ) : null}
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] text-gray-400/80">{resourceUriLabel}</span>
          {isSafeExternalUrl(block.uri) ? (
            <a
              className="min-w-0 flex-1 truncate font-mono text-[10px] text-sky-200 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              href={block.uri}
              rel="noreferrer noopener"
              target="_blank"
              title={block.uri}
            >
              {block.uri}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-300" title={block.uri}>
              {block.uri}
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
            {renderTruncatedNotice(`${key}:truncated`, textPreview.isTruncated, t)}
          </>
        ) : null}
      </div>
    );
  }
  if (block.type === 'image') {
    return isSafeMediaSource(block.source, 'image') ? (
      <figure key={key} className="overflow-hidden rounded-md bg-black/20 p-2">
        <img
          src={block.source}
          alt={block.title?.trim() || t?.('chat.toolResultImage') || 'Tool result image'}
          className="max-h-80 max-w-full object-contain"
          loading="lazy"
        />
        {block.title ? <figcaption className="pt-1 text-[10px] text-gray-400/80">{block.title}</figcaption> : null}
      </figure>
    ) : renderUnavailableMedia(block, key, copyMessageToClipboard, t);
  }
  if (block.type === 'audio') {
    return isSafeMediaSource(block.source, 'audio') ? (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {block.title ? <div className="mb-1 text-[10px] text-gray-400/80">{block.title}</div> : null}
        <audio controls preload="metadata" className="h-9 w-full" src={block.source}>
          {t?.('chat.toolResultAudioUnsupported') ?? 'Audio playback is not supported.'}
        </audio>
      </div>
    ) : renderUnavailableMedia(block, key, copyMessageToClipboard, t);
  }
  if (block.type === 'diff') {
    const preview = buildRichResultTextPreview(block.content);
    return (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {block.path ? <div className="mb-1 truncate font-mono text-[10px] text-gray-400/80">{block.path}</div> : null}
        <pre
          className={`overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-300 custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}
          role="region"
          aria-label={outputRegionLabel}
          tabIndex={0}
        >
          {preview.text}
        </pre>
        {renderTruncatedNotice(`${key}:truncated`, preview.isTruncated, t)}
      </div>
    );
  }

  const visibleItems = block.items.slice(0, MAX_VISIBLE_RESULT_LIST_ITEMS);
  const totalItems = Math.max(block.totalItems ?? block.items.length, block.items.length);
  const omittedItemCount = Math.max(0, totalItems - visibleItems.length);
  return (
    <div key={key}>
      <ul
        className="max-h-56 list-disc space-y-0.5 overflow-auto rounded-md bg-black/20 py-2 pl-7 pr-2 text-[11px] text-gray-300 custom-scrollbar"
        role="region"
        aria-label={outputRegionLabel}
        tabIndex={0}
      >
        {visibleItems.map((item, itemIndex) => (
          <li key={`${itemIndex}:${item}`} className="break-words">{item}</li>
        ))}
      </ul>
      {omittedItemCount > 0 ? (
        <div className="pt-1 text-[10px] text-gray-400/80">
          {t?.('chat.toolResultItemsOmitted', { count: omittedItemCount })
            ?? `${omittedItemCount} additional items omitted from the preview.`}
        </div>
      ) : null}
    </div>
  );
}

export const ToolResultBlocks = memo(function ToolResultBlocks({
  blocks,
  compact,
  copyMessageToClipboard,
  t,
}: ToolResultBlocksProps) {
  return (
    <div className="space-y-1.5" data-chat-tool-result-blocks="true">
      {blocks.map((block, index) => renderToolResultBlock(
        block,
        index,
        compact,
        copyMessageToClipboard,
        t,
      ))}
    </div>
  );
});
