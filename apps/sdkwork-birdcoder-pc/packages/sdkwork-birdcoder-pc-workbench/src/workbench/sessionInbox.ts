import {
  resolveAgentSessionViewSortTimestamp,
  type AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export const AGENT_SESSION_INBOX_GROUP_MODES = ['project', 'provider', 'chronological'] as const;
export type AgentSessionInboxGroupMode = (typeof AGENT_SESSION_INBOX_GROUP_MODES)[number];

export const AGENT_SESSION_INBOX_SORT_MODES = ['provider', 'smart', 'recent', 'created'] as const;
export type AgentSessionInboxSortMode = (typeof AGENT_SESSION_INBOX_SORT_MODES)[number];

export const AGENT_SESSION_INBOX_FILTERS = [
  'all',
  'attention',
  'executing',
  'failed',
  'pinned',
  'unread',
] as const;
export type AgentSessionInboxFilter = (typeof AGENT_SESSION_INBOX_FILTERS)[number];

export type AgentSessionInboxAttentionLevel =
  'pinned' | 'attention' | 'executing' | 'failed' | 'unread' | 'normal';

const ATTENTION_LEVEL_RANK: Readonly<Record<AgentSessionInboxAttentionLevel, number>> = {
  pinned: 0,
  attention: 1,
  executing: 2,
  failed: 3,
  unread: 4,
  normal: 5,
};

export function resolveAgentSessionAttentionLevel(
  session: Pick<AgentSessionView, 'pinned' | 'runtimeStatus' | 'unread'>,
): AgentSessionInboxAttentionLevel {
  if (session.pinned) return 'pinned';
  if (
    session.runtimeStatus === 'awaiting_approval' ||
    session.runtimeStatus === 'awaiting_tool' ||
    session.runtimeStatus === 'awaiting_user'
  ) {
    return 'attention';
  }
  if (session.runtimeStatus === 'initializing' || session.runtimeStatus === 'streaming') {
    return 'executing';
  }
  if (session.runtimeStatus === 'failed') return 'failed';
  if (session.unread) return 'unread';
  return 'normal';
}

export function resolveAgentSessionInboxRank(
  session: Pick<AgentSessionView, 'pinned' | 'runtimeStatus' | 'unread'>,
): number {
  return ATTENTION_LEVEL_RANK[resolveAgentSessionAttentionLevel(session)];
}

export function resolveAgentSessionActivityTimestamp(
  session: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
): number {
  return resolveAgentSessionViewSortTimestamp(session);
}

function resolveCreatedTimestamp(session: Pick<AgentSessionView, 'createdAt'>): number {
  const timestamp = Date.parse(session.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveProviderRecencyTimestamp(
  session: Pick<AgentSessionView, 'providerRecencyAt'>,
): number {
  const timestamp = session.providerRecencyAt ? Date.parse(session.providerRecencyAt) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasProviderDirectoryEntry(session: AgentSessionView): boolean {
  return Boolean(
    session.providerSessionId &&
    (session.providerDirectoryVersion ||
      session.providerSortKey ||
      session.providerRecencyAt ||
      session.providerTitle ||
      session.providerArchived !== undefined ||
      session.providerVisible !== undefined),
  );
}

export function isAgentSessionVisibleInInbox(
  session: Pick<
    AgentSessionView,
    'archived' | 'providerArchived' | 'providerVisible' | 'status'
  >,
  includeArchived = false,
): boolean {
  return (
    includeArchived ||
    (session.status !== 'archived' &&
      session.archived !== true &&
      session.providerArchived !== true &&
      session.providerVisible !== false)
  );
}

function compareProviderDirectoryEntries(left: AgentSessionView, right: AgentSessionView): number {
  const leftHasDirectory = hasProviderDirectoryEntry(left);
  const rightHasDirectory = hasProviderDirectoryEntry(right);
  if (leftHasDirectory !== rightHasDirectory) {
    return leftHasDirectory ? -1 : 1;
  }
  if (!leftHasDirectory) {
    return (
      resolveAgentSessionActivityTimestamp(right) - resolveAgentSessionActivityTimestamp(left) ||
      left.id.localeCompare(right.id)
    );
  }
  return (
    Number(Boolean(right.pinned) || Boolean(right.providerPinned))
      - Number(Boolean(left.pinned) || Boolean(left.providerPinned)) ||
    Number(resolveAgentSessionAttentionLevel(right) === 'attention')
      - Number(resolveAgentSessionAttentionLevel(left) === 'attention') ||
    resolveProviderRecencyTimestamp(right) - resolveProviderRecencyTimestamp(left) ||
    (left.providerSortKey ?? '').localeCompare(right.providerSortKey ?? '') ||
    resolveAgentSessionActivityTimestamp(right) - resolveAgentSessionActivityTimestamp(left) ||
    left.engineId.localeCompare(right.engineId) ||
    left.id.localeCompare(right.id)
  );
}

export function compareAgentSessionInboxEntries(
  left: AgentSessionView,
  right: AgentSessionView,
  mode: AgentSessionInboxSortMode = 'provider',
): number {
  if (mode === 'provider') {
    return compareProviderDirectoryEntries(left, right);
  }
  const priority =
    mode === 'smart' ? resolveAgentSessionInboxRank(left) - resolveAgentSessionInboxRank(right) : 0;
  if (priority !== 0) return priority;

  const timestampDifference =
    mode === 'created'
    ? resolveCreatedTimestamp(right) - resolveCreatedTimestamp(left)
    : resolveAgentSessionActivityTimestamp(right) - resolveAgentSessionActivityTimestamp(left);
  return timestampDifference || left.id.localeCompare(right.id);
}

export function sortAgentSessionInboxEntries(
  sessions: readonly AgentSessionView[],
  mode: AgentSessionInboxSortMode = 'provider',
): AgentSessionView[] {
  if (sessions.length < 2) return sessions as AgentSessionView[];
  return [...sessions].sort((left, right) => compareAgentSessionInboxEntries(left, right, mode));
}
