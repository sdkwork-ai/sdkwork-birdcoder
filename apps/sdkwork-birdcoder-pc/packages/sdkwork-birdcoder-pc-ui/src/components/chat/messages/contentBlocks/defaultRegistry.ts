import {
  ActivityContentBlockRenderer,
  CommandsContentBlockRenderer,
  FileChangesContentBlockRenderer,
  MarkdownContentBlockRenderer,
  TaskProgressContentBlockRenderer,
  ToolCallsContentBlockRenderer,
} from './ContentBlockRenderers.tsx';
import { createChatMessageContentBlockRendererRegistry } from './registry.ts';
import type { ChatMessageContentBlockRendererEntry } from './registry.ts';

const FALLBACK_CONTENT_BLOCK_RENDERER_ENTRY: ChatMessageContentBlockRendererEntry = {
  id: 'fallback.markdown',
  blockType: 'markdown',
  priority: 0,
  Component: MarkdownContentBlockRenderer,
};

const DEFAULT_CONTENT_BLOCK_RENDERER_ENTRIES: readonly ChatMessageContentBlockRendererEntry[] = [
  {
    id: 'markdown',
    blockType: 'markdown',
    priority: 10,
    Component: MarkdownContentBlockRenderer,
  },
  {
    id: 'activity',
    blockType: 'activity',
    priority: 20,
    Component: ActivityContentBlockRenderer,
  },
  {
    id: 'file-changes',
    blockType: 'file-changes',
    priority: 10,
    Component: FileChangesContentBlockRenderer,
  },
  {
    id: 'commands',
    blockType: 'commands',
    priority: 10,
    Component: CommandsContentBlockRenderer,
  },
  {
    id: 'task-progress',
    blockType: 'task-progress',
    priority: 10,
    Component: TaskProgressContentBlockRenderer,
  },
  {
    id: 'tool-calls',
    blockType: 'tool-calls',
    priority: 10,
    Component: ToolCallsContentBlockRenderer,
  },
];

export function createDefaultChatMessageContentBlockRendererRegistry() {
  return createChatMessageContentBlockRendererRegistry(
    DEFAULT_CONTENT_BLOCK_RENDERER_ENTRIES,
    FALLBACK_CONTENT_BLOCK_RENDERER_ENTRY,
  );
}

export const defaultChatMessageContentBlockRendererRegistry =
  createDefaultChatMessageContentBlockRendererRegistry();
