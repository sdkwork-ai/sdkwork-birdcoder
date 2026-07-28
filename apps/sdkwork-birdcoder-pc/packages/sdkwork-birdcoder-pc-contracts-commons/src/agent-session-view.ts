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
  'awaiting_user', 'completed', 'failed', 'terminated', 'cancelled', 'unknown',
  'stale',
] as const;
export type AgentSessionRuntimeDisplayStatus =
  (typeof AGENT_SESSION_RUNTIME_DISPLAY_STATUSES)[number];

export const AGENT_SESSION_ACTIVITY_PHASES = [
  'ready', 'queued', 'running', 'waiting', 'awaiting_input', 'completed',
  'failed', 'cancelled', 'idle', 'closed', 'archived', 'deleted', 'unknown',
] as const;
export type AgentSessionActivityPhase = (typeof AGENT_SESSION_ACTIVITY_PHASES)[number];

export const AGENT_SESSION_ACTIVITY_FRESHNESS_VALUES = [
  'fresh', 'stale', 'unsupported', 'unavailable',
] as const;
export type AgentSessionActivityFreshness =
  (typeof AGENT_SESSION_ACTIVITY_FRESHNESS_VALUES)[number];

export type AgentSessionActivitySource =
  | 'session' | 'turn' | 'interaction' | 'runtime_binding' | 'user_state';

export interface AgentSessionActivityVersionsView {
  session: string;
  latestTurn?: string;
  latestInteractionId?: string;
  latestInteraction?: string;
  latestRuntimeBindingId?: string;
  latestRuntimeBinding?: string;
  pendingInteraction?: string;
  currentRuntimeBinding?: string;
  userState?: string;
}

export interface AgentSessionLatestTurnActivityView {
  id: string;
  status: 'requested' | 'running' | 'completed' | 'failed' | 'cancelled';
  updatedAt: string;
  version: string;
}

export interface AgentSessionPendingInteractionActivityView {
  id: string;
  kind: 'approval' | 'user_question';
  status: string;
  updatedAt: string;
  version: string;
}

export interface AgentSessionRuntimeBindingActivityView {
  id: string;
  status: 'active' | 'deactivated' | 'failed' | 'deleted';
  updatedAt: string;
  version: string;
}

export interface AgentSessionProviderActivityView {
  state?: 'idle' | 'working' | 'waiting' | 'failed';
  freshness: AgentSessionActivityFreshness;
  evidenceKind?: 'provider_status' | 'provider_event' | 'provider_lock' | 'provider_process';
  interactionHint?: 'approval_required' | 'user_input_required';
  observedAt?: string;
  freshUntil?: string;
}

/**
 * Disposable projection of the sdkwork-agents activity snapshot. It is not an
 * API DTO or persistence authority.
 */
export interface AgentSessionActivityView {
  activityAt: string;
  source: AgentSessionActivitySource;
  observedAt?: string;
  freshUntil?: string;
  freshness: AgentSessionActivityFreshness;
  phase: AgentSessionActivityPhase;
  versions: AgentSessionActivityVersionsView;
  latestTurn?: AgentSessionLatestTurnActivityView;
  pendingInteraction?: AgentSessionPendingInteractionActivityView;
  runtimeBinding?: AgentSessionRuntimeBindingActivityView;
  provider?: AgentSessionProviderActivityView;
}

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
  'resources', 'task-progress', 'lifecycle', 'interactions', 'tool-calls',
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

export const AGENT_SESSION_ITEM_LIFECYCLE_EVENT_KINDS = [
  'started', 'completed', 'retrying', 'compacted', 'checkpoint', 'blocked',
  'stopped', 'cancelled', 'failed',
] as const;
export type AgentSessionItemLifecycleEventKind =
  (typeof AGENT_SESSION_ITEM_LIFECYCLE_EVENT_KINDS)[number];

export interface AgentSessionItemTokenUsageView {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
}

export interface AgentSessionItemLifecycleEventView {
  id: string;
  kind: AgentSessionItemLifecycleEventKind;
  detail?: string;
  attempt?: number;
  retryAt?: string;
  durationMs?: number;
  cost?: number;
  usage?: AgentSessionItemTokenUsageView;
  automatic?: boolean;
}

export const AGENT_SESSION_ITEM_INTERACTION_STATUSES = [
  'pending', 'approved', 'answered', 'completed', 'denied', 'rejected',
  'cancelled', 'failed',
] as const;
export type AgentSessionItemInteractionStatus =
  (typeof AGENT_SESSION_ITEM_INTERACTION_STATUSES)[number];

export interface AgentSessionItemInteractionOptionView {
  label: string;
  value?: string;
  description?: string;
}

export interface AgentSessionItemInteractionQuestionView {
  id?: string;
  header?: string;
  question: string;
  options?: readonly AgentSessionItemInteractionOptionView[];
  multiple?: boolean;
  allowCustomAnswer?: boolean;
  answers?: readonly string[];
}

export interface AgentSessionItemInteractionView {
  id: string;
  kind: 'approval' | 'question';
  status: AgentSessionItemInteractionStatus;
  title?: string;
  prompt?: string;
  detail?: string;
  action?: string;
  resources?: readonly string[];
  questions?: readonly AgentSessionItemInteractionQuestionView[];
  answer?: string;
  decision?: string;
  requiresResponse?: boolean;
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
  interaction?: AgentSessionItemInteractionView;
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

export const AGENT_SESSION_TASK_ITEM_STATUSES = [
  'blocked', 'cancelled', 'completed', 'pending', 'running',
] as const;
export type AgentSessionTaskItemStatus = (typeof AGENT_SESSION_TASK_ITEM_STATUSES)[number];

export interface AgentSessionTaskItemView {
  id?: string;
  text: string;
  status: AgentSessionTaskItemStatus;
}

export interface AgentSessionTaskProgressView {
  total: number;
  completed: number;
  items?: readonly AgentSessionTaskItemView[];
}

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
  lifecycleEvents?: AgentSessionItemLifecycleEventView[];
  resources?: AgentSessionItemResourceView[];
  taskProgress?: AgentSessionTaskProgressView;
}

export interface AgentSessionPageInfoView {
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export type AgentSessionItemViewSource = Readonly<AgentSessionItemView>;
export type AgentSessionProtocolNoticeKind =
  | 'blocked' | 'cancelled' | 'compression' | 'failed' | 'info' | 'retry'
  | 'stopped' | 'warning';

export interface AgentSessionView {
  id: string;
  agentId: string;
  projectId: string;
  activity?: AgentSessionActivityView;
  runtimeBindingId?: string;
  runtimeLocationId?: string;
  title: string;
  status: AgentSessionDisplayStatus;
  hostMode: WorkbenchHostMode;
  engineId: string;
  modelId: string;
  providerId: string;
  providerBindingId?: string;
  transportKind?: string;
  providerSessionId?: string;
  runtimeStatus?: AgentSessionRuntimeDisplayStatus;
  createdAt: string;
  updatedAt: string;
  lastTurnAt?: string;
  lastMessageAt?: string;
  lastRuntimeEventAt?: string;
  lastAttentionAt?: string;
  lastUserActivityAt?: string;
  sortTimestamp?: string;
  transcriptUpdatedAt?: string | null;
  serverVersion?: string;
  lastItemSequence?: string;
  lastReadItemSequence?: string;
  displayTime: string;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  itemPageInfo?: AgentSessionPageInfoView;
  items: AgentSessionItemView[];
}

function parseTimestamp(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function resolveAgentSessionViewSortTimestamp(
  session: Pick<
    AgentSessionView,
    | 'lastAttentionAt'
    | 'lastMessageAt'
    | 'lastRuntimeEventAt'
    | 'lastTurnAt'
    | 'lastUserActivityAt'
    | 'sortTimestamp'
    | 'transcriptUpdatedAt'
    | 'updatedAt'
    | 'createdAt'
  >,
): number {
  const explicit = Number(session.sortTimestamp);
  return Math.max(
    Number.isFinite(explicit) && explicit > 0 ? explicit : 0,
    parseTimestamp(session.lastMessageAt),
    parseTimestamp(session.lastRuntimeEventAt),
    parseTimestamp(session.lastAttentionAt),
    parseTimestamp(session.lastUserActivityAt),
    parseTimestamp(session.lastTurnAt),
    parseTimestamp(session.transcriptUpdatedAt),
    parseTimestamp(session.updatedAt),
    parseTimestamp(session.createdAt),
  );
}

export function compareAgentSessionViewsByActivity(
  left: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
  right: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
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
  session: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
): string {
  return String(resolveAgentSessionViewSortTimestamp(session));
}

export function compareAgentSessionViewSortTimestamps(
  left: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
  right: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
): number {
  return resolveAgentSessionViewSortTimestamp(left) - resolveAgentSessionViewSortTimestamp(right);
}

export function buildAgentSessionViewSynchronizationVersion(
  session: Parameters<typeof resolveAgentSessionViewSortTimestamp>[0],
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
    lifecycleEvents: item.lifecycleEvents ?? null,
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

export function buildAgentSessionItemLogicalMatchKey(item: AgentSessionItemView): string {
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
  return buildAgentSessionItemLogicalMatchKey(left) ===
    buildAgentSessionItemLogicalMatchKey(right);
}

function buildAgentSessionItemIdentityMatchKey(
  item: AgentSessionItemView,
): string | null {
  const itemId = item.id.trim();
  return itemId
    ? stringifyBirdCoderApiJson([item.sessionId.trim(), itemId])
    : null;
}

type AgentSessionItemMatchIndexes = number | Set<number>;

function addAgentSessionItemMatchIndexEntry(
  indexesByKey: Map<string, AgentSessionItemMatchIndexes>,
  key: string,
  index: number,
): void {
  const existingIndexes = indexesByKey.get(key);
  if (existingIndexes === undefined) {
    indexesByKey.set(key, index);
    return;
  }
  if (typeof existingIndexes === 'number') {
    if (existingIndexes !== index) {
      indexesByKey.set(key, new Set([existingIndexes, index]));
    }
    return;
  }
  existingIndexes.add(index);
}

function removeAgentSessionItemMatchIndexEntry(
  indexesByKey: Map<string, AgentSessionItemMatchIndexes>,
  key: string,
  index: number,
): void {
  const existingIndexes = indexesByKey.get(key);
  if (existingIndexes === undefined) {
    return;
  }
  if (typeof existingIndexes === 'number') {
    if (existingIndexes === index) {
      indexesByKey.delete(key);
    }
    return;
  }
  existingIndexes.delete(index);
  if (existingIndexes.size === 0) {
    indexesByKey.delete(key);
    return;
  }
  if (existingIndexes.size === 1) {
    const remainingIndex = existingIndexes.values().next().value;
    if (remainingIndex !== undefined) {
      indexesByKey.set(key, remainingIndex);
    }
  }
}

function resolveFirstAgentSessionItemMatchIndex(
  indexes: AgentSessionItemMatchIndexes | undefined,
): number {
  if (indexes === undefined) {
    return -1;
  }
  if (typeof indexes === 'number') {
    return indexes;
  }
  let firstIndex = Number.MAX_SAFE_INTEGER;
  for (const index of indexes) {
    firstIndex = Math.min(firstIndex, index);
  }
  return firstIndex;
}

export interface AgentSessionItemMatchIndex {
  findMatchingIndex: (item: AgentSessionItemView) => number;
}

class MutableAgentSessionItemMatchIndex implements AgentSessionItemMatchIndex {
  private readonly indexedItems: Array<AgentSessionItemView | undefined> = [];
  private readonly identityIndexesByKey = new Map<
    string,
    AgentSessionItemMatchIndexes
  >();
  private logicalIndexesByKey: Map<
    string,
    AgentSessionItemMatchIndexes
  > | null = null;
  private readonly provisionalIndexesByLogicalKey = new Map<
    string,
    AgentSessionItemMatchIndexes
  >();

  append(index: number, item: AgentSessionItemView): void {
    this.indexedItems[index] = item;
    const identityKey = buildAgentSessionItemIdentityMatchKey(item);
    if (identityKey) {
      addAgentSessionItemMatchIndexEntry(this.identityIndexesByKey, identityKey, index);
    } else {
      addAgentSessionItemMatchIndexEntry(
        this.provisionalIndexesByLogicalKey,
        buildAgentSessionItemLogicalMatchKey(item),
        index,
      );
    }
    if (this.logicalIndexesByKey) {
      addAgentSessionItemMatchIndexEntry(
        this.logicalIndexesByKey,
        buildAgentSessionItemLogicalMatchKey(item),
        index,
      );
    }
  }

  findMatchingIndex(item: AgentSessionItemView): number {
    const identityKey = buildAgentSessionItemIdentityMatchKey(item);
    if (identityKey) {
      const identityIndex = resolveFirstAgentSessionItemMatchIndex(
        this.identityIndexesByKey.get(identityKey),
      );
      if (identityIndex >= 0) {
        return identityIndex;
      }
      return resolveFirstAgentSessionItemMatchIndex(
        this.provisionalIndexesByLogicalKey.get(
          buildAgentSessionItemLogicalMatchKey(item),
        ),
      );
    }
    const logicalKey = buildAgentSessionItemLogicalMatchKey(item);
    return resolveFirstAgentSessionItemMatchIndex(
      this.resolveLogicalIndexes().get(logicalKey),
    );
  }

  replace(
    index: number,
    previous: AgentSessionItemView,
    next: AgentSessionItemView,
  ): void {
    const previousLogicalKey = buildAgentSessionItemLogicalMatchKey(previous);
    if (this.logicalIndexesByKey) {
      removeAgentSessionItemMatchIndexEntry(
        this.logicalIndexesByKey,
        previousLogicalKey,
        index,
      );
    }
    const previousIdentityKey = buildAgentSessionItemIdentityMatchKey(previous);
    if (previousIdentityKey) {
      removeAgentSessionItemMatchIndexEntry(
        this.identityIndexesByKey,
        previousIdentityKey,
        index,
      );
    } else {
      removeAgentSessionItemMatchIndexEntry(
        this.provisionalIndexesByLogicalKey,
        previousLogicalKey,
        index,
      );
    }
    this.append(index, next);
  }

  private resolveLogicalIndexes(): Map<string, AgentSessionItemMatchIndexes> {
    if (this.logicalIndexesByKey) {
      return this.logicalIndexesByKey;
    }
    const logicalIndexesByKey = new Map<string, AgentSessionItemMatchIndexes>();
    this.indexedItems.forEach((item, index) => {
      if (item) {
        addAgentSessionItemMatchIndexEntry(
          logicalIndexesByKey,
          buildAgentSessionItemLogicalMatchKey(item),
          index,
        );
      }
    });
    this.logicalIndexesByKey = logicalIndexesByKey;
    return logicalIndexesByKey;
  }
}

export function buildAgentSessionItemMatchIndex(
  items: readonly AgentSessionItemView[],
): AgentSessionItemMatchIndex {
  const matchIndex = new MutableAgentSessionItemMatchIndex();
  items.forEach((item, index) => matchIndex.append(index, item));
  return matchIndex;
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
    id: incoming.id.trim() ? incoming.id : existing.id,
    commands: incoming.commands ?? existing.commands,
    fileChanges: incoming.fileChanges ?? existing.fileChanges,
    metadata: incoming.metadata ?? existing.metadata,
    lifecycleEvents: mergeAgentSessionItemCollection(
      existing.lifecycleEvents,
      incoming.lifecycleEvents,
    ),
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
  const matchIndex = new MutableAgentSessionItemMatchIndex();
  for (const item of items) {
    const matchingIndex = matchIndex.findMatchingIndex(item);
    if (matchingIndex < 0) {
      matchIndex.append(deduplicated.length, item);
      deduplicated.push(item);
      continue;
    }
    const previousItem = deduplicated[matchingIndex]!;
    const mergedItem = mergeAgentSessionItemViews(previousItem, item);
    if (mergedItem !== previousItem) {
      deduplicated[matchingIndex] = mergedItem;
      matchIndex.replace(matchingIndex, previousItem, mergedItem);
    }
  }
  return deduplicated.length === items.length && deduplicated.every((item, index) => item === items[index])
    ? items as AgentSessionItemView[]
    : deduplicated;
}

function isSupersededTransientAgentSessionItem(
  existingItem: AgentSessionItemView,
  latestTurnRoleKeys: ReadonlySet<string>,
): boolean {
  if (existingItem.metadata?.transient !== true) {
    return false;
  }
  const turnId = existingItem.turnId?.trim() ?? '';
  if (!turnId) {
    return false;
  }
  return latestTurnRoleKeys.has(stringifyBirdCoderApiJson([
    existingItem.sessionId.trim(),
    turnId,
    existingItem.role,
  ]));
}

export function mergeLatestAgentSessionItems(
  existingItems: readonly AgentSessionItemView[],
  latestItems: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const latestTurnRoleKeys = new Set(
    latestItems.flatMap((item) => {
      const turnId = item.turnId?.trim() ?? '';
      return turnId
        ? [stringifyBirdCoderApiJson([item.sessionId.trim(), turnId, item.role])]
        : [];
    }),
  );
  const retainedExistingItems = existingItems.filter(
    (existingItem) => !isSupersededTransientAgentSessionItem(
      existingItem,
      latestTurnRoleKeys,
    ),
  );
  return deduplicateAgentSessionItemViews([...retainedExistingItems, ...latestItems]);
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
    | 'lastAttentionAt'
    | 'lastMessageAt'
    | 'lastRuntimeEventAt'
    | 'lastTurnAt'
    | 'lastUserActivityAt'
    | 'sortTimestamp'
    | 'transcriptUpdatedAt'
    | 'updatedAt'
    | 'createdAt'
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
