import type { ComponentType, ReactNode } from 'react';
import type { ChatMessageContentBlock } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';

export interface ChatMessageContentBlockRendererProps {
  block: ChatMessageContentBlock;
  context: ChatMessageRenderContext;
}

export type ChatMessageContentBlockRendererComponent = ComponentType<
  ChatMessageContentBlockRendererProps
>;

export interface ChatMessageContentBlockRendererEntry {
  id: string;
  blockType: ChatMessageContentBlock['type'];
  priority: number;
  Component: ChatMessageContentBlockRendererComponent;
}

export interface ChatMessageContentBlockRendererRegistry {
  register(entry: ChatMessageContentBlockRendererEntry): void;
  resolve(block: ChatMessageContentBlock): ChatMessageContentBlockRendererEntry;
  list(): readonly ChatMessageContentBlockRendererEntry[];
}

function scoreContentBlockEntry(
  entry: ChatMessageContentBlockRendererEntry,
  block: ChatMessageContentBlock,
): number {
  return entry.blockType === block.type ? entry.priority : -1;
}

export function createChatMessageContentBlockRendererRegistry(
  entries: readonly ChatMessageContentBlockRendererEntry[] = [],
  fallbackEntry: ChatMessageContentBlockRendererEntry,
): ChatMessageContentBlockRendererRegistry {
  const entriesById = new Map<string, ChatMessageContentBlockRendererEntry>();

  for (const entry of entries) {
    entriesById.set(entry.id, entry);
  }

  return {
    register(entry) {
      entriesById.set(entry.id, entry);
    },
    resolve(block) {
      let bestEntry: ChatMessageContentBlockRendererEntry | null = null;
      let bestScore = -1;

      for (const entry of entriesById.values()) {
        const score = scoreContentBlockEntry(entry, block);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }

      return bestEntry ?? fallbackEntry;
    },
    list() {
      return Array.from(entriesById.values());
    },
  };
}
