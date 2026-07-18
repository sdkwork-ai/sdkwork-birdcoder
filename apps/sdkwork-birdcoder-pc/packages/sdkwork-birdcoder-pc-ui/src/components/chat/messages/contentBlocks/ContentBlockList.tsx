import { memo } from 'react';
import type { BirdCoderChatMessageView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import { defaultChatMessageContentBlockRendererRegistry } from './defaultRegistry.ts';
import type { ChatMessageContentBlockRendererRegistry } from './registry.ts';

export interface ContentBlockListProps {
  view: BirdCoderChatMessageView;
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
        return <BlockRenderer key={`${view.messageId}:${block.type}:${index}`} block={block} context={context} />;
      })}
    </>
  );
});
