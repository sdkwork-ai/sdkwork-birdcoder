import type { CSSProperties } from 'react';
import type { ChatMessageLayout } from './types.ts';

export function buildTranscriptSurfaceStyle(containIntrinsicSize: string): CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}

export function resolveTranscriptSurfaceIntrinsicSize(
  layout: ChatMessageLayout,
  isUser: boolean,
): string {
  if (layout === 'sidebar') {
    return '180px';
  }

  return isUser ? '160px' : '320px';
}

export const CHAT_MESSAGE_PROSE_CLASSNAME =
  'prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10';

export const CHAT_MESSAGE_MAIN_PROSE_CLASSNAME =
  `${CHAT_MESSAGE_PROSE_CLASSNAME} prose-p:first:mt-0 prose-p:last:mb-0 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none`;
