import React, { memo } from 'react';
import { AlertCircle, ExternalLink, FileText, Link2 } from 'lucide-react';
import type { ChatMessageToolCall } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

type ToolResultBlock = NonNullable<ChatMessageToolCall['resultBlocks']>[number];

export interface ToolResultBlocksProps {
  blocks: readonly ToolResultBlock[];
  compact: boolean;
  t?: ChatMessageTranslate;
}

const MAX_RICH_RESULT_TEXT_CHARACTERS = 24_000;

function buildRichResultTextPreview(text: string): string {
  if (text.length <= MAX_RICH_RESULT_TEXT_CHARACTERS) {
    return text;
  }
  const tailLength = 6_000;
  return `${text.slice(0, MAX_RICH_RESULT_TEXT_CHARACTERS - tailLength)}\n\n...\n\n${text.slice(-tailLength)}`;
}

function isSafeExternalUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

function isSafeMediaSource(value: string, kind: 'audio' | 'image'): boolean {
  return isSafeExternalUrl(value)
    || value.startsWith('blob:')
    || value.startsWith(`data:${kind}/`);
}

function renderToolResultBlock(
  block: ToolResultBlock,
  index: number,
  compact: boolean,
  t?: ChatMessageTranslate,
) {
  const key = `${block.type}:${index}`;
  if (block.type === 'text') {
    return (
      <pre key={key} className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}>
        {buildRichResultTextPreview(block.text)}
      </pre>
    );
  }
  if (block.type === 'error') {
    return (
      <div key={key} className="flex items-start gap-2 rounded-md bg-red-500/10 px-2 py-2 text-[11px] text-red-200" role="alert">
        <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 whitespace-pre-wrap break-words">{block.message}</span>
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
            <div className="mt-0.5 line-clamp-2 text-gray-500">{block.description}</div>
          ) : null}
        </div>
      </div>
    );
  }
  if (block.type === 'resource') {
    const resourceLabel = block.name?.trim() || block.uri;
    return (
      <div key={key} className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2 text-gray-300">
          <FileText size={13} className="shrink-0 text-violet-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{resourceLabel}</span>
          {block.mimeType ? <span className="shrink-0 text-[10px] text-gray-600">{block.mimeType}</span> : null}
        </div>
        {block.text ? (
          <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-gray-400 custom-scrollbar">
            {buildRichResultTextPreview(block.text)}
          </pre>
        ) : (
          <div className="mt-0.5 truncate font-mono text-[10px] text-gray-600" title={block.uri}>{block.uri}</div>
        )}
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
        {block.title ? <figcaption className="pt-1 text-[10px] text-gray-500">{block.title}</figcaption> : null}
      </figure>
    ) : null;
  }
  if (block.type === 'audio') {
    return isSafeMediaSource(block.source, 'audio') ? (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {block.title ? <div className="mb-1 text-[10px] text-gray-500">{block.title}</div> : null}
        <audio controls preload="metadata" className="h-9 w-full" src={block.source}>
          {t?.('chat.toolResultAudioUnsupported') ?? 'Audio playback is not supported.'}
        </audio>
      </div>
    ) : null;
  }
  if (block.type === 'diff') {
    return (
      <div key={key} className="rounded-md bg-black/20 p-2">
        {block.path ? <div className="mb-1 truncate font-mono text-[10px] text-gray-500">{block.path}</div> : null}
        <pre className={`overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-300 custom-scrollbar ${compact ? 'max-h-40' : 'max-h-64'}`}>
          {buildRichResultTextPreview(block.content)}
        </pre>
      </div>
    );
  }

  return (
    <ul key={key} className="max-h-56 list-disc space-y-0.5 overflow-auto rounded-md bg-black/20 py-2 pl-7 pr-2 text-[11px] text-gray-300 custom-scrollbar">
      {block.items.slice(0, 100).map((item, itemIndex) => (
        <li key={`${itemIndex}:${item}`} className="break-words">{item}</li>
      ))}
    </ul>
  );
}

export const ToolResultBlocks = memo(function ToolResultBlocks({
  blocks,
  compact,
  t,
}: ToolResultBlocksProps) {
  return (
    <div className="space-y-1.5" data-chat-tool-result-blocks="true">
      {blocks.map((block, index) => renderToolResultBlock(block, index, compact, t))}
    </div>
  );
});
