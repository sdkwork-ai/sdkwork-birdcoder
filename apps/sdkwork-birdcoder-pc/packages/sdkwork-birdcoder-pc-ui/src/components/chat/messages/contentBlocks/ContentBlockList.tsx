import { memo } from 'react';
import type { AgentSessionItemPresentation } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import { defaultChatMessageContentBlockRendererRegistry } from './defaultRegistry.ts';
import type { ChatMessageContentBlockRendererRegistry } from './registry.ts';

export interface ContentBlockListProps {
  view: AgentSessionItemPresentation;
  context: ChatMessageRenderContext;
  registry?: ChatMessageContentBlockRendererRegistry;
}

export const ContentBlockList = memo(function ContentBlockList({
  view,
  context,
  registry = defaultChatMessageContentBlockRendererRegistry,
}: ContentBlockListProps) {
  return (
    <>
      {view.blocks.map((block, index) => {
        const entry = registry.resolve(block);
        const BlockRenderer = entry.Component;
        return <BlockRenderer key={`${view.sessionItemId}:${block.type}:${index}`} block={block} context={context} />;
      })}
    </>
  );
});
