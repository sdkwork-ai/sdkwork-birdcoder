import type {
  AgentSessionItemPresentation,
  AgentSessionItemViewKind,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type {
  ChatMessageLayout,
  ChatMessageRendererEntry,
  ChatMessageRendererMatch,
} from './types.ts';

export interface ChatMessageRendererRegistry {
  register(entry: ChatMessageRendererEntry): void;
  resolve(view: AgentSessionItemPresentation): ChatMessageRendererEntry;
  list(): readonly ChatMessageRendererEntry[];
}

function normalizeMatchValues<T extends string>(
  value: T | readonly T[] | undefined,
): readonly T[] {
  if (!value) {
    return [];
  }

  return (Array.isArray(value) ? value : [value]) as readonly T[];
}

function matchesViewKind(
  match: ChatMessageRendererMatch,
  viewKind: AgentSessionItemViewKind,
): boolean {
  const viewKinds = normalizeMatchValues(match.viewKind);
  return viewKinds.length === 0 || viewKinds.includes(viewKind);
}

function matchesEngineId(
  match: ChatMessageRendererMatch,
  engineId: string | undefined,
): boolean {
  if (!match.engineId) {
    return true;
  }

  return match.engineId === engineId;
}

function matchesRole(
  match: ChatMessageRendererMatch,
  role: AgentSessionItemPresentation['source']['role'],
): boolean {
  const roles = normalizeMatchValues(match.role);
  return roles.length === 0 || roles.includes(role);
}

function scoreRendererMatch(
  entry: ChatMessageRendererEntry,
  view: AgentSessionItemPresentation,
): number {
  const { match } = entry;
  if (!matchesViewKind(match, view.kind)) {
    return -1;
  }
  if (!matchesEngineId(match, view.engineId)) {
    return -1;
  }
  if (!matchesRole(match, view.source.role)) {
    return -1;
  }

  let score = entry.priority;
  if (match.engineId) {
    score += 1000;
  }
  if (match.viewKind) {
    score += 100;
  }
  if (match.role) {
    score += 10;
  }
  return score;
}

export function createChatMessageRendererRegistry(
  entries: readonly ChatMessageRendererEntry[] = [],
  fallbackEntry: ChatMessageRendererEntry,
): ChatMessageRendererRegistry {
  const entriesById = new Map<string, ChatMessageRendererEntry>();

  for (const entry of entries) {
    entriesById.set(entry.id, entry);
  }

  return {
    register(entry) {
      entriesById.set(entry.id, entry);
    },
    resolve(view) {
      let bestEntry: ChatMessageRendererEntry | null = null;
      let bestScore = -1;

      for (const entry of entriesById.values()) {
        const score = scoreRendererMatch(entry, view);
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

export function estimateRendererHeight(
  registry: ChatMessageRendererRegistry,
  view: AgentSessionItemPresentation,
  layout: ChatMessageLayout,
): number {
  return registry.resolve(view).estimateHeight(view, layout);
}
