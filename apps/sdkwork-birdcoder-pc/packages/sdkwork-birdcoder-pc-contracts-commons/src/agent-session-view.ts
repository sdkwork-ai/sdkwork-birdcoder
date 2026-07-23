import type { FileChange } from './file-change.ts';
import { stringifyBirdCoderApiJson } from './json.ts';

/**
 * Memory-only presentation contracts for canonical sdkwork-agents Session and
 * Session Item data. These types are never persistence, API, persisted read-model, or IM
 * Message authorities.
 */
export const WORKBENCH_HOST_MODES = ['web', 'desktop', 'server'] as const;
export type WorkbenchHostMode = (typeof WORKBENCH_HOST_MODES)[number];

export const AGENT_SESSION_DISPLAY_STATUSES = [
  'draft', 'active', 'paused', 'completed', 'archived',
] as const;
export type AgentSessionDisplayStatus = (typeof AGENT_SESSION_DISPLAY_STATUSES)[number];

export const AGENT_SESSION_RUNTIME_DISPLAY_STATUSES = [
  'initializing', 'ready', 'streaming', 'awaiting_tool', 'awaiting_approval',
  'awaiting_user', 'completed', 'failed', 'terminated', 'cancelled',
] as const;
export type AgentSessionRuntimeDisplayStatus =
  (typeof AGENT_SESSION_RUNTIME_DISPLAY_STATUSES)[number];

export const AGENT_SESSION_ARTIFACT_DISPLAY_KINDS = [
  'diff', 'patch', 'file', 'command-log', 'todo-list', 'pty-transcript',
  'structured-output', 'build-evidence', 'preview-evidence',
  'simulator-evidence', 'test-evidence', 'release-evidence',
  'diagnostic-bundle',
] as const;
export type AgentSessionArtifactDisplayKind =
  (typeof AGENT_SESSION_ARTIFACT_DISPLAY_KINDS)[number];

export const AGENT_SESSION_ITEM_DISPLAY_ROLES = [
  'user', 'assistant', 'system', 'tool', 'planner', 'reviewer',
] as const;
export type AgentSessionItemDisplayRole =
  (typeof AGENT_SESSION_ITEM_DISPLAY_ROLES)[number];

export const AGENT_SESSION_ITEM_VIEW_KINDS = [
  'user.text', 'assistant.text', 'assistant.activity', 'tool.result',
  'system.notice', 'planner.plan', 'reviewer.feedback',
] as const;
export type AgentSessionItemViewKind = (typeof AGENT_SESSION_ITEM_VIEW_KINDS)[number];

export const AGENT_SESSION_ITEM_CONTENT_BLOCK_TYPES = [
  'markdown', 'notice', 'reasoning', 'activity', 'file-changes', 'commands',
  'resources', 'task-progress', 'tool-calls',
] as const;
export type AgentSessionItemContentBlockType =
  (typeof AGENT_SESSION_ITEM_CONTENT_BLOCK_TYPES)[number];

export const AGENT_SESSION_ITEM_TOOL_CALL_KINDS = [
  'command', 'file', 'search', 'web', 'mcp', 'agent', 'skill', 'media',
  'task', 'approval', 'question', 'other',
] as const;
export type AgentSessionItemToolCallKind =
  (typeof AGENT_SESSION_ITEM_TOOL_CALL_KINDS)[number];
export type AgentSessionItemToolCallStatus =
  | 'pending' | 'running' | 'success' | 'error' | 'cancelled' | 'waiting';
export type AgentSessionItemToolCallPresentation = 'notice';

export const AGENT_SESSION_ITEM_RESOURCE_KINDS = [
  'file', 'image', 'audio', 'uri', 'citation', 'skill', 'mention',
] as const;
export type AgentSessionItemResourceKind =
  (typeof AGENT_SESSION_ITEM_RESOURCE_KINDS)[number];

export interface AgentSessionItemReasoningView {
  id: string;
  summary: string;
  title?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface AgentSessionItemResourceOriginView {
  kind: 'file' | 'symbol' | 'resource';
  name?: string;
  path?: string;
  uri?: string;
  clientName?: string;
  lineStart?: number;
  lineEnd?: number;
  columnStart?: number;
  columnEnd?: number;
  excerpt?: string;
}

export interface AgentSessionItemResourceCitationView {
  lineStart?: number;
  lineEnd?: number;
  note?: string;
  threadIds?: readonly string[];
}

export interface AgentSessionItemResourceView {
  id: string;
  kind: AgentSessionItemResourceKind;
  name?: string;
  path?: string;
  uri?: string;
  mediaSource?: string;
  mimeType?: string;
  description?: string;
  origin?: AgentSessionItemResourceOriginView;
  citation?: AgentSessionItemResourceCitationView;
}

export type AgentSessionItemToolResultBlockView =
  | { type: 'text'; text: string }
  | { type: 'image'; source: string; mimeType?: string; title?: string }
  | { type: 'audio'; source: string; mimeType?: string; title?: string }
  | { type: 'resource'; uri?: string; name?: string; mimeType?: string; text?: string; description?: string; size?: number }
  | { type: 'link'; url: string; title?: string; description?: string }
  | { type: 'diff'; content: string; path?: string }
  | { type: 'list'; items: readonly string[]; totalItems?: number }
  | { type: 'error'; message: string };

export interface AgentSessionItemToolCallView {
  id: string;
  type: string;
  name: string;
  arguments: string;
  kind?: AgentSessionItemToolCallKind;
  status?: AgentSessionItemToolCallStatus;
  presentation?: AgentSessionItemToolCallPresentation;
  output?: string;
  command?: string;
  target?: string;
  serverName?: string;
  title?: string;
  durationMs?: number;
  resultBlocks?: readonly AgentSessionItemToolResultBlockView[];
}

export interface AgentSessionCommandView {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  kind?: 'approval' | 'command' | 'file_change' | 'task' | 'tool' | 'user_question';
  toolName?: string;
  toolCallId?: string;
  runtimeStatus?: AgentSessionRuntimeDisplayStatus;
  requiresApproval?: boolean;
  requiresReply?: boolean;
}

export interface AgentSessionTaskProgressView { total: number; completed: number }

export interface AgentSessionItemView {
  id: string;
  sessionId: string;
  turnId?: string;
  role: AgentSessionItemDisplayRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  timestamp?: number;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  fileChanges?: FileChange[];
  commands?: AgentSessionCommandView[];
  reasoning?: AgentSessionItemReasoningView[];
  resources?: AgentSessionItemResourceView[];
  taskProgress?: AgentSessionTaskProgressView;
}

export type AgentSessionItemViewSource = Readonly<AgentSessionItemView>;
export type AgentSessionProtocolNoticeKind =
  | 'blocked' | 'cancelled' | 'compression' | 'failed' | 'info' | 'retry'
  | 'stopped' | 'warning';

export interface AgentSessionView {
  id: string;
  projectId: string;
  runtimeLocationId?: string;
  title: string;
  status: AgentSessionDisplayStatus;
  hostMode: WorkbenchHostMode;
  engineId: string;
  modelId: string;
  nativeSessionId?: string;
  runtimeStatus?: AgentSessionRuntimeDisplayStatus;
  createdAt: string;
  updatedAt: string;
  lastTurnAt?: string;
  sortTimestamp?: string;
  transcriptUpdatedAt?: string | null;
  displayTime: string;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  items: AgentSessionItemView[];
}

function parseTimestamp(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function resolveAgentSessionViewSortTimestamp(
  session: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
): number {
  const explicit = Number(session.sortTimestamp);
  return Number.isFinite(explicit) && explicit > 0
    ? explicit
    : Math.max(parseTimestamp(session.lastTurnAt), parseTimestamp(session.updatedAt), parseTimestamp(session.createdAt));
}

export function compareAgentSessionViewsByActivity(
  left: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
  right: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
): number {
  return resolveAgentSessionViewSortTimestamp(left) - resolveAgentSessionViewSortTimestamp(right);
}

const EXECUTING_AGENT_SESSION_STATUSES = new Set<AgentSessionRuntimeDisplayStatus>([
  'initializing', 'streaming', 'awaiting_tool', 'awaiting_approval', 'awaiting_user',
]);
const BUSY_AGENT_SESSION_STATUSES = new Set<AgentSessionRuntimeDisplayStatus>([
  'initializing', 'streaming',
]);

export function isAgentSessionViewExecuting(
  session: Pick<AgentSessionView, 'runtimeStatus'> | null | undefined,
): boolean {
  return Boolean(
    session?.runtimeStatus && EXECUTING_AGENT_SESSION_STATUSES.has(session.runtimeStatus),
  );
}

export function isAgentSessionViewEngineBusy(
  session: Pick<AgentSessionView, 'runtimeStatus'> | null | undefined,
): boolean {
  return Boolean(
    session?.runtimeStatus && BUSY_AGENT_SESSION_STATUSES.has(session.runtimeStatus),
  );
}

export function resolveAgentSessionViewSortTimestampString(
  session: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
): string {
  return String(resolveAgentSessionViewSortTimestamp(session));
}

export function compareAgentSessionViewSortTimestamps(
  left: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
  right: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt'>,
): number {
  return resolveAgentSessionViewSortTimestamp(left) - resolveAgentSessionViewSortTimestamp(right);
}

export function buildAgentSessionViewSynchronizationVersion(
  session: Pick<AgentSessionView, 'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt' | 'transcriptUpdatedAt'>,
  itemCount: number = 0,
): string {
  const normalizedItemCount = Number.isFinite(itemCount) && itemCount > 0
    ? Math.floor(itemCount)
    : 0;
  return `${resolveAgentSessionViewSortTimestampString(session)}:${normalizedItemCount}:${session.transcriptUpdatedAt ?? ''}`;
}

function buildAgentSessionItemSynchronizationSignature(item: AgentSessionItemView): string {
  return stringifyBirdCoderApiJson({
    commands: item.commands ?? null,
    content: item.content,
    createdAt: item.createdAt,
    fileChanges: item.fileChanges ?? null,
    id: item.id,
    metadata: item.metadata ?? null,
    name: item.name ?? null,
    reasoning: item.reasoning ?? null,
    resources: item.resources ?? null,
    role: item.role,
    sessionId: item.sessionId,
    taskProgress: item.taskProgress ?? null,
    timestamp: item.timestamp ?? null,
    toolCallId: item.tool_call_id ?? null,
    toolCalls: item.tool_calls ?? null,
    turnId: item.turnId ?? null,
  });
}

function buildAgentSessionItemLogicalKey(item: AgentSessionItemView): string {
  return stringifyBirdCoderApiJson([
    item.sessionId.trim(),
    item.turnId?.trim() ?? '',
    item.role,
    item.content.trim(),
    item.tool_call_id?.trim() ?? '',
    item.name?.trim() ?? '',
  ]);
}

export function areAgentSessionItemsEquivalent(
  left: AgentSessionItemView,
  right: AgentSessionItemView,
): boolean {
  return left === right ||
    buildAgentSessionItemSynchronizationSignature(left) ===
      buildAgentSessionItemSynchronizationSignature(right);
}

export function areAgentSessionItemsLogicallyMatched(
  left: AgentSessionItemView,
  right: AgentSessionItemView,
): boolean {
  if (left.sessionId.trim() !== right.sessionId.trim()) return false;
  const leftId = left.id.trim();
  const rightId = right.id.trim();
  if (left === right || (Boolean(leftId) && leftId === rightId)) {
    return true;
  }
  if (leftId && rightId) {
    return false;
  }
  return buildAgentSessionItemLogicalKey(left) === buildAgentSessionItemLogicalKey(right);
}

function mergeAgentSessionItemCollection<TItem extends { id?: string }>(
  existing: readonly TItem[] | undefined,
  incoming: readonly TItem[] | undefined,
): TItem[] | undefined {
  if (!existing?.length) return incoming ? [...incoming] : undefined;
  if (!incoming?.length) return [...existing];
  const itemsByKey = new Map<string, TItem>();
  for (const [index, item] of [...existing, ...incoming].entries()) {
    const key = item.id?.trim() || `item:${index}`;
    itemsByKey.set(key, item);
  }
  return [...itemsByKey.values()];
}

export function mergeAgentSessionItemViews(
  existing: AgentSessionItemView,
  incoming: AgentSessionItemView,
): AgentSessionItemView {
  if (areAgentSessionItemsEquivalent(existing, incoming)) return existing;
  const merged: AgentSessionItemView = {
    ...existing,
    ...incoming,
    commands: incoming.commands ?? existing.commands,
    fileChanges: incoming.fileChanges ?? existing.fileChanges,
    metadata: incoming.metadata ?? existing.metadata,
    reasoning: mergeAgentSessionItemCollection(existing.reasoning, incoming.reasoning),
    resources: mergeAgentSessionItemCollection(existing.resources, incoming.resources),
    taskProgress: incoming.taskProgress ?? existing.taskProgress,
    tool_calls: incoming.tool_calls ?? existing.tool_calls,
  };
  return areAgentSessionItemsEquivalent(existing, merged) ? existing : merged;
}

export function deduplicateAgentSessionItemViews(
  items: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  if (items.length < 2) return items as AgentSessionItemView[];
  const deduplicated: AgentSessionItemView[] = [];
  for (const item of items) {
    const matchIndex = deduplicated.findIndex((candidate) =>
      areAgentSessionItemsLogicallyMatched(candidate, item),
    );
    if (matchIndex < 0) {
      deduplicated.push(item);
      continue;
    }
    deduplicated[matchIndex] = mergeAgentSessionItemViews(deduplicated[matchIndex]!, item);
  }
  return deduplicated.length === items.length && deduplicated.every((item, index) => item === items[index])
    ? items as AgentSessionItemView[]
    : deduplicated;
}

export function formatAgentSessionDisplayTime(
  updatedAt?: string,
  createdAt?: string,
  now: number = Date.now(),
): string {
  const updatedTimestamp = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const createdTimestamp = createdAt ? Date.parse(createdAt) : Number.NaN;
  const resolvedTimestamp = Number.isFinite(updatedTimestamp)
    ? updatedTimestamp
    : createdTimestamp;
  if (!Number.isFinite(resolvedTimestamp)) {
    return 'Unknown';
  }

  const deltaSeconds = Math.max(0, Math.floor((now - resolvedTimestamp) / 1_000));
  if (deltaSeconds < 60) return 'Just now';
  if (deltaSeconds < 3_600) {
    const minutes = Math.floor(deltaSeconds / 60);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  if (deltaSeconds < 86_400) {
    const hours = Math.floor(deltaSeconds / 3_600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(deltaSeconds / 86_400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatAgentSessionActivityDisplayTime(
  session: Pick<
    AgentSessionView,
    'lastTurnAt' | 'sortTimestamp' | 'updatedAt' | 'createdAt' | 'transcriptUpdatedAt'
  >,
  now: number = Date.now(),
): string {
  const activityTimestamp = resolveAgentSessionViewSortTimestamp(session);
  return formatAgentSessionDisplayTime(
    activityTimestamp > 0 ? new Date(activityTimestamp).toISOString() : undefined,
    session.createdAt,
    now,
  );
}
