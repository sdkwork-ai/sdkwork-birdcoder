import { memo } from 'react';
import type {
  AgentSessionItemPresentation,
  AgentSessionItemPresentationBlock,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import { defaultChatMessageContentBlockRendererRegistry } from './defaultRegistry.ts';
import type { ChatMessageContentBlockRendererRegistry } from './registry.ts';

export interface ContentBlockListProps {
  view: AgentSessionItemPresentation;
  context: ChatMessageRenderContext;
  registry?: ChatMessageContentBlockRendererRegistry;
}

function resolveContentBlockIdentity(
  block: AgentSessionItemPresentationBlock,
  occurrence: number,
): string {
  switch (block.type) {
    case 'markdown':
      return block.noticeKind ? `notice:${block.noticeKind}` : 'authored';
    case 'notice':
      return block.id;
    case 'activity':
      return block.sessionItemId;
    case 'file-changes':
      return block.items[0]?.path ?? String(occurrence);
    case 'commands':
      return block.items[0]?.toolCallId?.trim()
        || block.items[0]?.command
        || String(occurrence);
    case 'resources':
      return block.items[0]?.id ?? String(occurrence);
    case 'lifecycle':
      return block.events[0]?.id ?? String(occurrence);
    case 'interactions':
      return block.items[0]?.id ?? String(occurrence);
    case 'tool-calls':
      return block.calls[0]?.id ?? String(occurrence);
    case 'reasoning':
    case 'task-progress':
      return String(occurrence);
    default:
      return String(occurrence);
  }
}

export const ContentBlockList = memo(function ContentBlockList({
  view,
  context,
  registry = defaultChatMessageContentBlockRendererRegistry,
}: ContentBlockListProps) {
  const occurrencesByType = new Map<AgentSessionItemPresentationBlock['type'], number>();
  return (
    <>
      {view.blocks.map((block) => {
        const entry = registry.resolve(block);
        const BlockRenderer = entry.Component;
        const occurrence = occurrencesByType.get(block.type) ?? 0;
        occurrencesByType.set(block.type, occurrence + 1);
        const blockIdentity = resolveContentBlockIdentity(block, occurrence);
        return (
          <BlockRenderer
            key={`${view.sessionItemId}:${block.type}:${blockIdentity}`}
            block={block}
            context={context}
          />
        );
      })}
    </>
  );
});
