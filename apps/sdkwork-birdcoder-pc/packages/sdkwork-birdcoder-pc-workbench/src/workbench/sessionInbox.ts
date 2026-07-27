import {
  resolveAgentSessionViewSortTimestamp,
  type AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export const AGENT_SESSION_INBOX_GROUP_MODES = [
  'project',
  'provider',
  'chronological',
] as const;
export type AgentSessionInboxGroupMode = (typeof AGENT_SESSION_INBOX_GROUP_MODES)[number];

export const AGENT_SESSION_INBOX_SORT_MODES = ['smart', 'recent', 'created'] as const;
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
  | 'pinned'
  | 'attention'
  | 'executing'
  | 'failed'
  | 'unread'
  | 'normal';

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
  if (session.runtimeStatus === 'awaiting_approval' || session.runtimeStatus === 'awaiting_user') {
    return 'attention';
  }
  if (
    session.runtimeStatus === 'initializing'
    || session.runtimeStatus === 'streaming'
    || session.runtimeStatus === 'awaiting_tool'
  ) {
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

export function compareAgentSessionInboxEntries(
  left: AgentSessionView,
  right: AgentSessionView,
  mode: AgentSessionInboxSortMode = 'smart',
): number {
  const priority = mode === 'smart'
    ? resolveAgentSessionInboxRank(left) - resolveAgentSessionInboxRank(right)
    : 0;
  if (priority !== 0) return priority;

  const timestampDifference = mode === 'created'
    ? resolveCreatedTimestamp(right) - resolveCreatedTimestamp(left)
    : resolveAgentSessionActivityTimestamp(right) - resolveAgentSessionActivityTimestamp(left);
  return timestampDifference || left.id.localeCompare(right.id);
}

export function sortAgentSessionInboxEntries(
  sessions: readonly AgentSessionView[],
  mode: AgentSessionInboxSortMode = 'smart',
): AgentSessionView[] {
  if (sessions.length < 2) return sessions as AgentSessionView[];
  return [...sessions].sort((left, right) => compareAgentSessionInboxEntries(left, right, mode));
}
