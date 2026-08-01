import {
  resolveAgentSessionItemPresentation,
  resolveAgentTurnActivityPresentation,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type {
  AgentSessionItemPresentation,
  AgentSessionItemPresentationBlock,
  AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export interface ChatTurnProcessItemPresentation {
  sourceIndex: number;
  view: AgentSessionItemPresentation;
}

export interface ChatTurnProcessPresentation {
  completedAtMs?: number;
  isActive: boolean;
  itemCount: number;
  key: string;
  processBlockCount: number;
  startedAtMs?: number;
  targetIndex: number;
  items: readonly ChatTurnProcessItemPresentation[];
}

export interface ChatTurnProcessMessagePresentation {
  process?: ChatTurnProcessPresentation;
  suppressProcessBlocks: boolean;
}

export interface ResolveChatTurnProcessPresentationsOptions {
  engineId?: string;
  isLive?: boolean;
}

const PROCESS_BLOCK_TYPES = new Set<AgentSessionItemPresentationBlock['type']>([
  'notice',
  'reasoning',
  'activity',
  'file-changes',
  'commands',
  'resources',
  'task-progress',
  'lifecycle',
  'interactions',
  'tool-calls',
]);

function resolveScopeKeys(messages: readonly AgentSessionItemView[]): string[] {
  let fallbackTurnKey = 'turn:leading';
  return messages.map((message, index) => {
    const turnId = message.turnId?.trim();
    if (turnId) {
      fallbackTurnKey = `turn:${turnId}`;
      return fallbackTurnKey;
    }
    if (message.role === 'user') {
      fallbackTurnKey = `turn:user:${message.id.trim() || index}`;
    }
    return fallbackTurnKey;
  });
}

function isProcessBlock(block: AgentSessionItemPresentationBlock): boolean {
  return block.type === 'markdown'
    ? Boolean(block.noticeKind)
    : PROCESS_BLOCK_TYPES.has(block.type);
}

function isProviderCommentaryView(view: AgentSessionItemPresentation): boolean {
  return view.source.metadata?.providerMessagePhase === 'commentary';
}

function isProcessViewBlock(
  view: AgentSessionItemPresentation,
  block: AgentSessionItemPresentationBlock,
): boolean {
  return isProcessBlock(block)
    || (isProviderCommentaryView(view) && block.type === 'markdown');
}

function isAuthoredMarkdownView(view: AgentSessionItemPresentation): boolean {
  return !isProviderCommentaryView(view)
    && ['assistant', 'planner', 'reviewer'].includes(view.source.role)
    && view.blocks.some(
      (block) => block.type === 'markdown'
        && !block.noticeKind
        && block.content.trim().length > 0,
    );
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function resolveDurationBounds(
  messages: readonly AgentSessionItemView[],
  indexes: readonly number[],
): { startedAtMs?: number; completedAtMs?: number } {
  const started = indexes.flatMap((index) => {
    const timestamp = parseTimestamp(messages[index]?.createdAt);
    return timestamp === undefined ? [] : [timestamp];
  });
  const completed = indexes.flatMap((index) => {
    const timestamp = parseTimestamp(messages[index]?.completedAt);
    return timestamp === undefined ? [] : [timestamp];
  });
  return {
    startedAtMs: started.length > 0 ? Math.min(...started) : undefined,
    completedAtMs: completed.length > 0 ? Math.max(...completed) : undefined,
  };
}

function hasPendingInteraction(view: AgentSessionItemPresentation): boolean {
  return view.blocks.some((block) => {
    if (block.type === 'interactions') {
      return block.items.some((item) => item.requiresResponse || item.status === 'pending');
    }
    if (block.type === 'tool-calls') {
      return block.calls.some((call) => call.status === 'pending' || call.status === 'running');
    }
    return false;
  });
}

/**
 * Projects all non-authored turn work into one disclosure. This keeps provider
 * protocol events out of the primary transcript while preserving every detail
 * for an explicit expansion, matching the OpenCode/Codex turn model.
 */
export function resolveChatTurnProcessPresentations(
  messages: readonly AgentSessionItemView[],
  options: ResolveChatTurnProcessPresentationsOptions = {},
): ChatTurnProcessMessagePresentation[] {
  const scopeKeys = resolveScopeKeys(messages);
  const groups = new Map<string, number[]>();
  scopeKeys.forEach((key, index) => {
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  });
  const latestScopeKey = scopeKeys.at(-1) ?? '';
  const result = messages.map<ChatTurnProcessMessagePresentation>(() => ({
    suppressProcessBlocks: false,
  }));

  for (const [key, indexes] of groups) {
    const items = indexes.flatMap<ChatTurnProcessItemPresentation>((sourceIndex) => {
      const source = messages[sourceIndex];
      if (!source) return [];
      if (source.role === 'user') return [];
      const activitySummary = resolveAgentTurnActivityPresentation(messages, source, {
        engineId: options.engineId,
      });
      const view = resolveAgentSessionItemPresentation(source, {
        activitySummary,
        engineId: options.engineId,
        layout: 'main',
      });
      const processBlocks = view.blocks.filter((block) => isProcessViewBlock(view, block));
      if (processBlocks.length === 0) return [];
      return [{
        sourceIndex,
        view: {
          ...view,
          blocks: processBlocks,
          layoutHints: {
            ...view.layoutHints,
            hasCollapsibleSections: false,
          },
        },
      }];
    });
    if (items.length === 0) continue;

    const targetIndex = indexes.reduce((candidate, index) => {
      const source = messages[index];
      if (!source) return candidate;
      const activitySummary = resolveAgentTurnActivityPresentation(messages, source, {
        engineId: options.engineId,
      });
      const view = resolveAgentSessionItemPresentation(source, {
        activitySummary,
        engineId: options.engineId,
        layout: 'main',
      });
      return isAuthoredMarkdownView(view) ? index : candidate;
    }, indexes.at(-1) ?? 0);
    const bounds = resolveDurationBounds(messages, indexes);
    const isActive = Boolean(options.isLive && key === latestScopeKey);
    const process = {
      ...bounds,
      isActive,
      itemCount: items.length,
      key,
      processBlockCount: items.reduce((count, item) => count + item.view.blocks.length, 0),
      targetIndex,
      items,
    } satisfies ChatTurnProcessPresentation;
    for (const index of indexes) {
      result[index] = { suppressProcessBlocks: true };
    }
    result[targetIndex] = {
      process,
      suppressProcessBlocks: true,
    };
  }

  return result;
}

export function isChatTurnProcessInteractionPending(
  presentation: ChatTurnProcessPresentation,
): boolean {
  return presentation.items.some((item) => hasPendingInteraction(item.view));
}
