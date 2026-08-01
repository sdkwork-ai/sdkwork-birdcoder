import type {
  AgentSessionItemPageInfoView,
  AgentSessionPageInfoView,
  AgentSessionActivityView,
  AgentSessionItemReasoningView,
  AgentSessionItemLifecycleEventView,
  AgentSessionItemResourceView,
  AgentSessionItemView,
  AgentSessionView,
  AgentProjectView,
  AgentSessionProtocolNoticeKind,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  formatAgentSessionActivityDisplayTime,
  formatAgentSessionDisplayTime,
  isAgentSessionItemVisibleInTranscript,
  mergeAgentSessionItemReasoning,
  normalizeAgentSessionItemResources,
  normalizeAgentSessionItemLifecycleEvents,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { AgentResourceUserStateRecord } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  resolveWorkbenchCodeEngineForRuntimeBinding,
} from '../workbench/codeEngineCatalog.ts';
import { resolveAgentSessionActivityRuntimeStatus } from '../workbench/agentSessionActivity.ts';
import {
  mergeAgentSessionProjectionForStore,
  PROJECT_STORE_MAX_CACHED_SESSIONS,
} from '../stores/projectsStore.ts';
import { resolveAgentSessionFileChanges } from './agentSessionFileChanges.ts';
import {
  coalesceCodexUserContentResources,
  resolveAgentSessionUserContent,
  type AgentSessionUserContentProjection,
  type AgentSessionUserContentProviderIdentity,
} from './agentSessionUserContent.ts';
import {
  attachAgentSessionItemSourceWindow,
  inheritAgentSessionItemSourceWindow,
  normalizeAgentSessionItemSourceRecords,
  type AgentSessionItemSourceRecord,
} from './agentSessionItemSourceWindow.ts';
import { resolveAgentSessionProviderPayload } from './agentSessionProviderPayload.ts';
import { replayOpenCodeSessionItemRecords } from './openCodeSessionItemReplay.ts';

export type AgentSessionRecord = Awaited<
  ReturnType<IAgentSessionService['getSession']>
>;
export type AgentSessionItemRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionItems']>
>['items'][number];
export type AgentSessionUserStateRecord = AgentResourceUserStateRecord;
export type AgentSessionActivitySummaryRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionActivitySummaries']>
>['items'][number];

export interface AgentSessionViewContext {
  projectId: string;
  engineId?: string;
  modelId?: string;
  providerId?: string;
  providerBindingId?: string;
  runtimeBindingId?: string;
  hostMode?: AgentSessionView['hostMode'];
  transportKind?: string;
  providerSessionId?: string;
  providerTitle?: string;
  providerTitleSource?: string;
  providerPreview?: string;
  providerCreatedAt?: string;
  providerUpdatedAt?: string;
  providerRecencyAt?: string;
  providerPinned?: boolean;
  providerArchived?: boolean;
  providerVisible?: boolean;
  providerSortKey?: string;
  providerSource?: string;
  providerDirectoryVersion?: string;
  runtimeLocationId?: string;
  runtimeBindingStatus?: 'active' | 'deactivated' | 'failed' | 'deleted';
  runtimeBindingUpdatedAt?: string;
  userState?: AgentSessionUserStateRecord | null;
  itemPageInfo?: AgentSessionItemPageInfoView;
}

export interface ProjectAgentSessionPage {
  hasMore: boolean;
  hasNewer: boolean;
  project: AgentProjectView;
  windowShifted: boolean;
}

export interface LoadProjectAgentSessionPageOptions {
  resetWindow?: boolean;
}

interface LoadAgentSessionViewOptions {
  fallbackView?: AgentSessionView;
  reuseFallbackRuntimeMetadata?: boolean;
  tolerateAuxiliaryMetadataFailure?: boolean;
}

interface AuxiliaryMetadataResult<T> {
  failed: boolean;
  value: T | null;
}

const PROJECT_SESSION_PAGE_SIZE = 100;
const PROJECT_SESSION_CURSOR_MAX_LENGTH = 2_048;

export function normalizeProjectAgentSessionTargetCount(requestedCount: number): number {
  if (!Number.isFinite(requestedCount)) {
    return 1;
  }
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(requestedCount)));
}

function normalizePageInfo(
  pageInfo: Awaited<ReturnType<IAgentSessionService['listSessionActivitySummaries']>>['pageInfo'],
  requestedCursor: string | undefined,
  requestedPageSize: number,
): AgentSessionPageInfoView {
  if (pageInfo.mode !== 'cursor') {
    throw new Error('Agents Session activity inventory must use cursor pagination.');
  }
  if (pageInfo.pageSize !== requestedPageSize) {
    throw new Error(
      `Agents Session activity inventory returned page size ${pageInfo.pageSize} while ${requestedPageSize} was requested.`,
    );
  }
  const nextCursor = pageInfo.nextCursor;
  if (pageInfo.hasMore) {
    if (
      typeof nextCursor !== 'string'
      || !nextCursor
      || nextCursor.length > PROJECT_SESSION_CURSOR_MAX_LENGTH
      || nextCursor.trim() !== nextCursor
      || nextCursor === requestedCursor
    ) {
      throw new Error('Agents Session activity inventory returned a non-progressing cursor page.');
    }
  } else if (nextCursor !== null && nextCursor !== undefined) {
    throw new Error('Agents Session activity inventory terminal page must omit or null its cursor.');
  }
  return {
    hasMore: pageInfo.hasMore === true,
    hasNewer: false,
    mode: 'cursor',
    nextCursor: nextCursor ?? null,
    pageSize: requestedPageSize,
  };
}

function mergeAgentSessions(
  existing: readonly AgentSessionView[],
  incoming: readonly AgentSessionView[],
): AgentSessionView[] {
  const sessionsById = new Map(existing.map((session) => [session.id, session]));
  for (const session of incoming) {
    const existingSession = sessionsById.get(session.id);
    sessionsById.set(
      session.id,
      existingSession
        ? mergeAgentSessionProjectionForStore(existingSession, session)
        : session,
    );
  }
  return [...sessionsById.values()];
}

function resolveItemRole(
  kind: AgentSessionItemRecord['kind'],
): AgentSessionItemView['role'] {
  if (kind === 'user_input') {
    return 'user';
  }
  if (kind === 'tool_call' || kind === 'tool_result') {
    return 'tool';
  }
  if (kind === 'system_instruction' || kind === 'status_notice' || kind === 'error_notice') {
    return 'system';
  }
  return 'assistant';
}

function resolveItemContent(item: AgentSessionItemRecord): string {
  if (item.kind === 'reasoning') {
    return '';
  }

  const content = item.content?.trim();
  if (content) {
    return content;
  }
  const structuredContent = item.toolResult ?? item.toolArguments;
  if (structuredContent) {
    return JSON.stringify(structuredContent, null, 2);
  }
  return item.toolName?.trim() ?? '';
}

function resolveItemReasoning(
  item: AgentSessionItemRecord,
): AgentSessionItemReasoningView[] | undefined {
  if (item.kind !== 'reasoning') {
    return undefined;
  }

  const summary = item.content?.trim() ?? '';
  if (!summary) {
    return undefined;
  }

  const startedAt = item.createdAt;
  const completedAt = item.completedAt?.trim() || undefined;
  const startedTimestamp = Date.parse(startedAt);
  const completedTimestamp = completedAt ? Date.parse(completedAt) : Number.NaN;
  const durationMs = Number.isFinite(startedTimestamp)
    && Number.isFinite(completedTimestamp)
    && completedTimestamp >= startedTimestamp
    ? completedTimestamp - startedTimestamp
    : undefined;

  return [{
    id: item.itemId,
    summary,
    createdAt: item.createdAt,
    startedAt,
    ...(completedAt ? { completedAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  }];
}

function resolveDriveResourceKind(
  resourceRole: AgentSessionItemRecord['driveRefs'][number]['resourceRole'],
): AgentSessionItemResourceView['kind'] {
  if (resourceRole === 'image' || resourceRole === 'audio') {
    return resourceRole;
  }
  return 'file';
}

function resolveItemResources(
  item: AgentSessionItemRecord,
  providerProjection?: AgentSessionUserContentProjection | null,
  providerPayloadResources?: readonly AgentSessionItemResourceView[],
): AgentSessionItemResourceView[] | undefined {
  const driveRefs = Array.isArray(item.driveRefs) ? item.driveRefs : [];
  const driveResources = driveRefs
    .filter((resource) =>
      resource.status === 'active'
      && resource.driveSpaceId.trim()
      && resource.driveNodeId.trim(),
    )
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((resource) => ({
      id: resource.driveNodeId,
      kind: resolveDriveResourceKind(resource.resourceRole),
      uri: `drive://spaces/${encodeURIComponent(resource.driveSpaceId)}/nodes/${encodeURIComponent(resource.driveNodeId)}`,
      ...(resource.altText?.trim() ? { name: resource.altText.trim() } : {}),
    }));
  const resources = normalizeAgentSessionItemResources([
    ...driveResources,
    ...(providerProjection?.resources ?? []),
    ...(providerPayloadResources ?? []),
  ]);
  if (resources.length < 2) {
    return resources.length > 0 ? resources : undefined;
  }
  const resourceKeys = new Set<string>();
  return resources.filter((resource) => {
    const location = resource.path ?? resource.mediaSource ?? resource.uri;
    const key = location?.trim().toLowerCase() ?? `${resource.kind}:${resource.name ?? resource.id}`;
    if (resourceKeys.has(key)) {
      return false;
    }
    resourceKeys.add(key);
    return true;
  });
}

function resolveItemNoticeKind(
  item: AgentSessionItemRecord,
): AgentSessionProtocolNoticeKind | undefined {
  if (item.kind === 'error_notice') {
    return 'failed';
  }
  if (item.kind !== 'status_notice') {
    return undefined;
  }
  if (item.status === 'failed') {
    return 'failed';
  }
  if (item.status === 'cancelled') {
    return 'cancelled';
  }
  return 'info';
}

const PROVIDER_NATIVE_TOOL_TYPES = new Set([
  'agent_execution_blocked',
  'agent_execution_stopped',
  'advisor_tool_result',
  'bash_code_execution_tool_result',
  'code_execution_tool_result',
  'collab_agent_tool_call',
  'command_execution',
  'compaction',
  'context_compaction',
  'context_window_will_overflow',
  'custom_tool_call',
  'custom_tool_call_output',
  'dynamic_tool_call',
  'entered_review_mode',
  'exited_review_mode',
  'file_change',
  'function_call',
  'function_call_output',
  'finished',
  'image_generation',
  'image_generation_call',
  'image_view',
  'local_shell_call',
  'mcp_tool_call',
  'mcp_tool_result',
  'mcp_tool_use',
  'max_session_turns',
  'patch',
  'permission_asked',
  'permission_replied',
  'permission_v2_asked',
  'permission_v2_replied',
  'question_asked',
  'question_rejected',
  'question_replied',
  'question_v2_asked',
  'question_v2_rejected',
  'question_v2_replied',
  'rate_limit_event',
  'retry',
  'result',
  'server_tool_use',
  'sleep',
  'sub_agent_activity',
  'subtask',
  'system',
  'snapshot',
  'step_finish',
  'step_start',
  'tool',
  'text_editor_code_execution_tool_result',
  'tool_progress',
  'tool_result',
  'tool_search_call',
  'tool_search_output',
  'tool_search_tool_result',
  'tool_use',
  'tool_use_summary',
  'web_fetch_tool_result',
  'web_search',
  'web_search_call',
  'web_search_tool_result',
  'turn_completed',
  'turn_failed',
  'turn_started',
  'user_cancelled',
  'invalid_stream',
  'loop_detected',
  'chat_compressed',
]);

const PROVIDER_TRANSCRIPT_HIDDEN_ITEM_TYPES = new Set([
  'entered_review_mode',
  'exited_review_mode',
  'sleep',
]);

const PROVIDER_TRANSCRIPT_HIDDEN_DYNAMIC_TOOL_NAMES = new Set([
  'load_workspace_dependencies',
]);

const CODEX_VISUALIZATION_FILE_PATH_PATTERN =
  /(?:^|[\\/])\.codex[\\/]visualizations[\\/]\d{4}[\\/]\d{2}[\\/]\d{2}[\\/]([a-zA-Z0-9_-]+)[\\/][a-z0-9]+(?:-[a-z0-9]+)*\.html$/u;

interface AgentSessionItemTranscriptMetadata {
  transcriptGrouping?: 'consecutive-images';
  transcriptVisibility?: 'hidden';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProviderNativeItemType(value: unknown): string {
  return readNonEmptyString(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[./\-\s]+/gu, '_');
}

function resolveProviderNativeItemRecord(value: unknown): Record<string, unknown> | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const envelope = readRecord(record.params)
    ?? readRecord(record.properties)
    ?? readRecord(record.payload)
    ?? record;
  return readRecord(envelope.item)
    ?? readRecord(envelope.part)
    ?? readRecord(envelope.contentBlock)
    ?? readRecord(envelope.content_block)
    ?? envelope;
}

function readProviderNativeToolPayload(value: unknown): Record<string, unknown> | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const envelopeRecords = [
    record,
    readRecord(record.params),
    readRecord(record.properties),
    readRecord(record.payload),
  ];
  for (const envelope of envelopeRecords) {
    if (!envelope) {
      continue;
    }
    if (readRecord(envelope.item) || readRecord(envelope.part)
      || readRecord(envelope.contentBlock) || readRecord(envelope.content_block)) {
      return record;
    }
    const envelopeType = normalizeProviderNativeItemType(
      envelope.type ?? envelope.method ?? envelope.sessionUpdate,
    );
    if (PROVIDER_NATIVE_TOOL_TYPES.has(envelopeType)) {
      return record;
    }
  }
  const type = normalizeProviderNativeItemType(
    record.type ?? record.method ?? record.sessionUpdate,
  );
  return PROVIDER_NATIVE_TOOL_TYPES.has(type) ? record : null;
}

function hasVisibleProviderTextFragments(value: unknown): boolean {
  return Array.isArray(value) && value.some((fragment) => (
    Boolean(readNonEmptyString(readRecord(fragment)?.text))
  ));
}

function hasVisibleProviderReasoningSummary(value: unknown): boolean {
  return Array.isArray(value) && value.some((summary) => Boolean(readNonEmptyString(summary)));
}

function isNonEmptyProviderString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidCodexAutomationUpdateArguments(value: unknown): boolean {
  const argumentsRecord = readRecord(value);
  if (!argumentsRecord) {
    return false;
  }
  const mode = argumentsRecord.mode;
  if (mode === 'view' || mode === 'delete') {
    return isNonEmptyProviderString(argumentsRecord.id);
  }
  if (!['create', 'suggested_create', 'update', 'suggested_update'].includes(String(mode))) {
    return false;
  }
  if (
    !isNonEmptyProviderString(argumentsRecord.name)
    || !isNonEmptyProviderString(argumentsRecord.prompt)
    || !isNonEmptyProviderString(argumentsRecord.rrule)
    || !['ACTIVE', 'PAUSED'].includes(String(argumentsRecord.status))
    || (
      argumentsRecord.notificationPolicy !== undefined
      && argumentsRecord.notificationPolicy !== null
      && argumentsRecord.notificationPolicy !== 'failed_runs_only'
    )
    || (
      (mode === 'update' || mode === 'suggested_update')
      && !isNonEmptyProviderString(argumentsRecord.id)
    )
  ) {
    return false;
  }

  if (argumentsRecord.kind === 'heartbeat') {
    const destination = argumentsRecord.destination;
    const hasValidDestination = destination === undefined
      || destination === 'local'
      || destination === 'thread';
    return hasValidDestination
      && (destination === 'thread' || isNonEmptyProviderString(argumentsRecord.targetThreadId));
  }
  if (argumentsRecord.kind !== 'cron') {
    return false;
  }

  const projectId = argumentsRecord.projectId;
  const localEnvironmentConfigPath = argumentsRecord.localEnvironmentConfigPath;
  return (projectId === null || isNonEmptyProviderString(projectId))
    && isNonEmptyProviderString(argumentsRecord.model)
    && ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']
      .includes(String(argumentsRecord.reasoningEffort))
    && ['local', 'worktree'].includes(String(argumentsRecord.executionEnvironment))
    && (
      argumentsRecord.destination === undefined
      || argumentsRecord.destination === 'local'
      || argumentsRecord.destination === 'worktree'
    )
    && (
      localEnvironmentConfigPath === undefined
      || localEnvironmentConfigPath === null
      || isNonEmptyProviderString(localEnvironmentConfigPath)
    );
}

function resolveProviderFileChangePath(value: unknown): string {
  const change = readRecord(value);
  if (!change) {
    return '';
  }
  const kind = readRecord(change.kind);
  if (normalizeProviderNativeItemType(kind?.type) === 'update') {
    return readNonEmptyString(kind?.move_path ?? kind?.movePath ?? change.path);
  }
  return readNonEmptyString(change.path);
}

function hasVisibleProviderFileChanges(providerItem: Record<string, unknown>): boolean {
  if (!Array.isArray(providerItem.changes)) {
    return true;
  }
  if (providerItem.changes.some((change) => (
    !CODEX_VISUALIZATION_FILE_PATH_PATTERN.test(resolveProviderFileChangePath(change))
  ))) {
    return true;
  }

  const status = normalizeProviderNativeItemType(providerItem.status);
  if (status !== 'in_progress' && status !== 'completed') {
    return false;
  }
  return providerItem.changes.some((change) => {
    const kind = normalizeProviderNativeItemType(readRecord(readRecord(change)?.kind)?.type);
    return kind === 'add' || kind === 'update';
  });
}

function resolveItemTranscriptMetadata(
  item: AgentSessionItemRecord,
  userContent: AgentSessionUserContentProjection | null,
): AgentSessionItemTranscriptMetadata {
  if (
    userContent
    && !userContent.content.trim()
    && userContent.resources.length === 0
  ) {
    return { transcriptVisibility: 'hidden' };
  }
  if (item.kind !== 'tool_call' && item.kind !== 'tool_result') {
    return {};
  }
  const providerItem = resolveProviderNativeItemRecord(item.toolResult)
    ?? resolveProviderNativeItemRecord(item.toolArguments);
  const providerItemType = normalizeProviderNativeItemType(
    providerItem?.type ?? providerItem?.method ?? providerItem?.sessionUpdate,
  );
  if (!providerItem || !providerItemType) {
    return {};
  }
  if (providerItemType === 'image_view') {
    return { transcriptGrouping: 'consecutive-images' };
  }
  if (PROVIDER_TRANSCRIPT_HIDDEN_ITEM_TYPES.has(providerItemType)) {
    return { transcriptVisibility: 'hidden' };
  }
  if (
    providerItemType === 'hook_prompt'
    && !hasVisibleProviderTextFragments(providerItem.fragments)
  ) {
    return { transcriptVisibility: 'hidden' };
  }
  if (
    providerItemType === 'reasoning'
    && !hasVisibleProviderReasoningSummary(providerItem.summary)
  ) {
    return { transcriptVisibility: 'hidden' };
  }
  if (
    providerItemType === 'file_change'
    && !hasVisibleProviderFileChanges(providerItem)
  ) {
    return { transcriptVisibility: 'hidden' };
  }
  if (
    providerItemType === 'collab_agent_tool_call'
    && normalizeProviderNativeItemType(providerItem.tool) === 'wait'
  ) {
    return { transcriptVisibility: 'hidden' };
  }
  if (providerItemType === 'dynamic_tool_call') {
    const tool = normalizeProviderNativeItemType(providerItem.tool);
    if (PROVIDER_TRANSCRIPT_HIDDEN_DYNAMIC_TOOL_NAMES.has(tool)) {
      return { transcriptVisibility: 'hidden' };
    }
    if (
      tool === 'automation_update'
      && (
        normalizeProviderNativeItemType(providerItem.status) !== 'completed'
        || providerItem.success !== true
        || !isValidCodexAutomationUpdateArguments(providerItem.arguments)
      )
    ) {
      return { transcriptVisibility: 'hidden' };
    }
  }
  return {};
}

function resolveItemLifecycleEvents(
  item: AgentSessionItemRecord,
): AgentSessionItemLifecycleEventView[] | undefined {
  if (item.kind !== 'tool_call' && item.kind !== 'tool_result') {
    return undefined;
  }
  const providerPayload = readProviderNativeToolPayload(item.toolResult)
    ?? readProviderNativeToolPayload(item.toolArguments);
  if (!providerPayload) {
    return undefined;
  }
  const events = normalizeAgentSessionItemLifecycleEvents([providerPayload]);
  return events.length > 0 ? events : undefined;
}

function resolveItemToolCalls(item: AgentSessionItemRecord): unknown[] | undefined {
  if (item.kind !== 'tool_call' && item.kind !== 'tool_result') {
    return undefined;
  }

  const toolName = item.toolName?.trim() || 'tool';
  const toolCallId = item.toolCallId?.trim() || item.itemId;
  const providerPayload = readProviderNativeToolPayload(item.toolResult)
    ?? readProviderNativeToolPayload(item.toolArguments);
  if (providerPayload) {
    const providerId = readNonEmptyString(providerPayload.id)
      || readNonEmptyString(providerPayload.call_id)
      || readNonEmptyString(providerPayload.callID)
      || readNonEmptyString(providerPayload.callId)
      || readNonEmptyString(providerPayload.tool_use_id)
      || readNonEmptyString(providerPayload.toolUseId);
    const providerName = readNonEmptyString(providerPayload.name)
      || readNonEmptyString(providerPayload.tool);
    return [{
      ...providerPayload,
      ...(providerId ? {} : { id: toolCallId }),
      ...(providerName || toolName === 'tool' ? {} : { name: toolName }),
      ...(readNonEmptyString(providerPayload.status) ? {} : { status: item.status }),
    }];
  }
  return [{
    id: toolCallId,
    type: item.kind,
    name: toolName,
    status: item.status,
    ...(item.toolArguments ? { arguments: item.toolArguments } : {}),
    ...(item.toolResult ? { output: item.toolResult } : {}),
  }];
}

function resolveSessionStatus(
  status: AgentSessionRecord['status'],
): AgentSessionView['status'] {
  if (status === 'archived') {
    return 'archived';
  }
  if (status === 'closed') {
    return 'completed';
  }
  return 'active';
}

export function toAgentSessionItemView(
  item: AgentSessionItemRecord,
  providerIdentity?: AgentSessionUserContentProviderIdentity,
): AgentSessionItemView {
  const noticeKind = resolveItemNoticeKind(item);
  const userContent = resolveAgentSessionUserContent(item, providerIdentity);
  const transcriptMetadata = resolveItemTranscriptMetadata(item, userContent);
  const completedAt = item.completedAt
    ?? (['completed', 'failed', 'cancelled'].includes(item.status) ? item.updatedAt : undefined);
  const providerPayload = item.kind === 'tool_call' || item.kind === 'tool_result'
    ? resolveAgentSessionProviderPayload(
        [item.toolResult, item.toolArguments],
        {
          completedAt,
          createdAt: item.createdAt,
          isStreaming: completedAt === undefined,
          itemId: item.itemId,
        },
      )
    : null;
  const reasoning = mergeAgentSessionItemReasoning(
    resolveItemReasoning(item),
    providerPayload?.reasoning,
  );
  return {
    id: item.itemId,
    sessionId: item.sessionId,
    turnId: item.turnId ?? undefined,
    role: providerPayload?.role ?? resolveItemRole(item.kind),
    content: userContent?.content
      ?? (providerPayload
        ? providerPayload.content ?? ''
        : resolveItemContent(item)),
    metadata: {
      agentItemKind: item.kind,
      agentItemSequence: item.sequence,
      agentItemStatus: item.status,
      contentType: item.contentType,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      parentItemId: item.parentItemId ?? undefined,
      providerId: item.providerId ?? undefined,
      modelId: item.modelId ?? undefined,
      ...(noticeKind ? { noticeKind } : {}),
      ...(providerPayload?.messagePhase
        ? { providerMessagePhase: providerPayload.messagePhase }
        : {}),
      ...(providerPayload?.messageCompleted !== undefined
        ? { providerMessageCompleted: providerPayload.messageCompleted }
        : {}),
      ...transcriptMetadata,
    },
    createdAt: item.createdAt,
    completedAt,
    timestamp: Date.parse(item.createdAt),
    name: item.toolName ?? undefined,
    tool_calls: providerPayload?.consumesToolPayload
      ? providerPayload.toolCalls
      : resolveItemToolCalls(item),
    tool_call_id: item.toolCallId ?? undefined,
    fileChanges: resolveAgentSessionFileChanges(item.toolResult),
    lifecycleEvents: resolveItemLifecycleEvents(item),
    reasoning: reasoning.length > 0 ? reasoning : undefined,
    resources: resolveItemResources(item, userContent, providerPayload?.resources),
    taskProgress: providerPayload?.taskProgress,
  };
}

function isCodexUserContentCarrier(
  item: AgentSessionItemRecord,
  providerIdentity: AgentSessionUserContentProviderIdentity | undefined,
): boolean {
  return resolveAgentSessionUserContent(item, providerIdentity) !== null;
}

function hasSameCodexMessageIdentity(
  left: AgentSessionItemRecord,
  right: AgentSessionItemRecord,
): boolean {
  if (left.sessionId !== right.sessionId) {
    return false;
  }
  const leftProviderId = left.providerId?.trim();
  const rightProviderId = right.providerId?.trim();
  if (leftProviderId && rightProviderId && leftProviderId !== rightProviderId) {
    return false;
  }
  const leftTurnId = left.turnId?.trim();
  const rightTurnId = right.turnId?.trim();
  if (leftTurnId && rightTurnId) {
    return leftTurnId === rightTurnId;
  }
  return left.createdAt === right.createdAt;
}

function mergeCodexUserContentGroup(
  items: readonly AgentSessionItemRecord[],
  providerIdentity: AgentSessionUserContentProviderIdentity | undefined,
): AgentSessionItemView {
  const views = items.map((item) => toAgentSessionItemView(item, providerIdentity));
  const userIndex = items.findIndex((item) => item.kind === 'user_input');
  const targetIndex = userIndex >= 0 ? userIndex : 0;
  const target = views[targetIndex]!;
  const content = views
    .map((view) => view.content.trim())
    .filter(Boolean)
    .join('\n');
  const resources = normalizeAgentSessionItemResources(
    coalesceCodexUserContentResources(
      views.flatMap((view) => view.resources ?? []),
    ),
  );
  const metadata: Record<string, unknown> = {
    ...target.metadata,
    agentItemKind: 'user_input',
  };
  if (content || resources.length > 0) {
    delete metadata.transcriptVisibility;
  }
  return {
    ...target,
    role: 'user',
    content,
    metadata,
    resources: resources.length > 0 ? resources : undefined,
  };
}

export function toAgentSessionTranscriptItemViews(
  items: readonly AgentSessionItemRecord[],
  providerIdentity?: AgentSessionUserContentProviderIdentity,
): AgentSessionItemView[] {
  const projectedItems = providerIdentity?.engineId?.trim().toLowerCase() === 'opencode'
    ? replayOpenCodeSessionItemRecords(normalizeAgentSessionItemSourceRecords(
        items as readonly AgentSessionItemSourceRecord[],
      ))
    : items;
  const transcriptItems: AgentSessionItemView[] = [];
  let consecutiveImageGroupIndex: number | null = null;
  const appendTranscriptView = (view: AgentSessionItemView): void => {
    const grouping = readNonEmptyString(view.metadata?.transcriptGrouping);
    const visible = isAgentSessionItemVisibleInTranscript(view);
    if (grouping !== 'consecutive-images') {
      consecutiveImageGroupIndex = null;
      if (visible) {
        transcriptItems.push(view);
      }
      return;
    }
    if (!visible) {
      consecutiveImageGroupIndex = null;
      return;
    }
    if (consecutiveImageGroupIndex === null) {
      transcriptItems.push(view);
      consecutiveImageGroupIndex = transcriptItems.length - 1;
      return;
    }
    const previous = transcriptItems[consecutiveImageGroupIndex];
    if (!previous) {
      transcriptItems.push(view);
      consecutiveImageGroupIndex = transcriptItems.length - 1;
      return;
    }
    const resources = normalizeAgentSessionItemResources([
      ...(previous.resources ?? []),
      ...(view.resources ?? []),
    ]);
    transcriptItems[consecutiveImageGroupIndex] = {
      ...previous,
      completedAt: view.completedAt ?? previous.completedAt,
      resources: resources.length > 0 ? resources : undefined,
    };
  };
  for (let index = 0; index < projectedItems.length;) {
    const item = projectedItems[index]!;
    if (!isCodexUserContentCarrier(item, providerIdentity)) {
      const view = toAgentSessionItemView(item, providerIdentity);
      appendTranscriptView(view);
      index += 1;
      continue;
    }

    let groupEnd = index + 1;
    while (
      groupEnd < projectedItems.length
      && isCodexUserContentCarrier(projectedItems[groupEnd]!, providerIdentity)
      && hasSameCodexMessageIdentity(item, projectedItems[groupEnd]!)
    ) {
      groupEnd += 1;
    }
    const view = mergeCodexUserContentGroup(
      projectedItems.slice(index, groupEnd),
      providerIdentity,
    );
    appendTranscriptView(view);
    index = groupEnd;
  }
  return transcriptItems;
}

export function toAgentSessionView(
  session: AgentSessionRecord,
  context: AgentSessionViewContext,
  items: readonly AgentSessionItemRecord[] = [],
): AgentSessionView {
  const projectId = context.projectId.trim();
  if (!projectId || session.projectId?.trim() !== projectId) {
    throw new Error(
      `Agent session ${session.sessionId} does not belong to Agents project ${projectId}.`,
    );
  }
  const activityAt = session.lastItemAt ?? session.updatedAt;
  const parsedActivityAt = Date.parse(activityAt);
  const sessionItems = items
    .slice()
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence === rightSequence ? 0 : leftSequence < rightSequence ? -1 : 1;
    });
  const transcriptItems = toAgentSessionTranscriptItemViews(sessionItems, context);
  const canonicalTitle = session.title?.trim();
  const providerTitle = context.providerTitle?.trim();
  const title = context.userState?.customTitle?.trim()
    || (session.titleSource === 'user' ? canonicalTitle : undefined)
    || providerTitle
    || canonicalTitle
    || 'Untitled session';
  return attachAgentSessionItemSourceWindow({
    id: session.sessionId,
    agentId: session.agentId,
    projectId,
    runtimeBindingId: context.runtimeBindingId?.trim() || undefined,
    runtimeLocationId: context.runtimeLocationId,
    title,
    status: resolveSessionStatus(session.status),
    hostMode: context.hostMode ?? 'web',
    engineId: context.engineId?.trim() || context.providerId?.trim() || 'unknown',
    modelId: context.modelId?.trim() || 'auto',
    providerId: context.providerId?.trim() || 'unknown',
    providerBindingId: context.providerBindingId?.trim() || undefined,
    transportKind: context.transportKind?.trim() || undefined,
    providerSessionId: context.providerSessionId?.trim() || undefined,
    providerTitle: providerTitle || undefined,
    providerTitleSource: context.providerTitleSource?.trim() || undefined,
    providerPreview: context.providerPreview?.trim() || undefined,
    providerCreatedAt: context.providerCreatedAt,
    providerUpdatedAt: context.providerUpdatedAt,
    providerRecencyAt: context.providerRecencyAt,
    providerPinned: context.providerPinned,
    providerArchived: context.providerArchived,
    providerVisible: context.providerVisible,
    providerSortKey: context.providerSortKey?.trim() || undefined,
    providerSource: context.providerSource?.trim() || undefined,
    providerDirectoryVersion: context.providerDirectoryVersion,
    runtimeStatus: session.status === 'closed' || session.status === 'archived'
      ? 'completed'
      : context.runtimeBindingStatus === 'failed'
        ? 'failed'
        : !context.runtimeBindingId?.trim()
          ? 'unknown'
          : context.providerSessionId?.trim()
            ? 'unknown'
            : 'ready',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastItemAt ?? undefined,
    lastMessageAt: session.lastItemAt ?? undefined,
    lastRuntimeEventAt: context.runtimeBindingUpdatedAt,
    sortTimestamp: String(Number.isNaN(parsedActivityAt) ? 0 : parsedActivityAt),
    transcriptUpdatedAt: session.lastItemAt ?? null,
    serverVersion: session.version,
    lastItemSequence: session.lastItemSequence,
    lastReadItemSequence: context.userState?.lastReadItemSequence,
    displayTime: formatAgentSessionDisplayTime(activityAt, session.createdAt),
    pinned: Boolean(context.userState?.pinnedAt),
    archived: session.status === 'archived' || Boolean(context.userState?.hiddenAt),
    unread:
      context.userState?.lastReadItemSequence !== undefined
      && context.userState.lastReadItemSequence !== session.lastItemSequence,
    itemPageInfo: context.itemPageInfo,
    items: transcriptItems,
  }, sessionItems);
}

function readNullableString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function resolveSummaryActivityFreshness(
  summary: AgentSessionActivitySummaryRecord,
): AgentSessionActivityView['freshness'] {
  if (summary.presentationPhase !== 'unknown') {
    return 'fresh';
  }
  if (summary.providerActivity) {
    return summary.providerActivity.freshness;
  }
  const freshUntil = readNullableString(summary.freshness.freshUntil);
  if (freshUntil && Date.parse(freshUntil) <= Date.now()) {
    return 'stale';
  }
  return 'unavailable';
}

export function toAgentSessionActivityView(
  summary: AgentSessionActivitySummaryRecord,
): AgentSessionActivityView {
  const effectiveBinding = summary.currentRuntimeBinding ?? summary.latestRuntimeBinding;
  const providerActivity = summary.providerActivity;
  return {
    activityAt: summary.freshness.activityAt,
    source: summary.freshness.source,
    observedAt: readNullableString(summary.freshness.observedAt),
    freshUntil: readNullableString(summary.freshness.freshUntil),
    freshness: resolveSummaryActivityFreshness(summary),
    phase: summary.presentationPhase,
    versions: {
      session: summary.freshness.sessionVersion,
      latestTurn: summary.freshness.latestTurnVersion ?? undefined,
      latestInteractionId: summary.freshness.latestInteractionId ?? undefined,
      latestInteraction: summary.freshness.latestInteractionVersion ?? undefined,
      latestRuntimeBindingId: summary.freshness.latestRuntimeBindingId ?? undefined,
      latestRuntimeBinding: summary.freshness.latestRuntimeBindingVersion ?? undefined,
      pendingInteraction: summary.freshness.pendingInteractionVersion ?? undefined,
      currentRuntimeBinding: summary.freshness.currentRuntimeBindingVersion ?? undefined,
      userState: summary.freshness.userStateVersion ?? undefined,
    },
    latestTurn: summary.latestTurn ? {
      id: summary.latestTurn.turnId,
      status: summary.latestTurn.status,
      updatedAt: summary.latestTurn.updatedAt,
      version: summary.latestTurn.version,
    } : undefined,
    pendingInteraction: summary.pendingInteraction ? {
      id: summary.pendingInteraction.interactionId,
      kind: summary.pendingInteraction.kind,
      status: summary.pendingInteraction.status,
      updatedAt: summary.pendingInteraction.updatedAt,
      version: summary.pendingInteraction.version,
    } : undefined,
    runtimeBinding: effectiveBinding ? {
      id: effectiveBinding.runtimeBindingId,
      status: effectiveBinding.status,
      updatedAt: effectiveBinding.updatedAt,
      version: effectiveBinding.version,
    } : undefined,
    provider: providerActivity ? {
      state: providerActivity.state ?? undefined,
      freshness: providerActivity.freshness,
      evidenceKind: providerActivity.evidenceKind ?? undefined,
      interactionHint: providerActivity.interactionHint ?? undefined,
      observedAt: readNullableString(providerActivity.observedAt),
      freshUntil: readNullableString(providerActivity.freshUntil),
    } : undefined,
  };
}

export function toAgentSessionViewFromActivitySummary(
  summary: AgentSessionActivitySummaryRecord,
): AgentSessionView {
  const projectId = summary.session.projectId?.trim() ?? '';
  if (!projectId) {
    throw new Error(`Agent session ${summary.session.sessionId} has no Agents project identity.`);
  }
  const currentBinding = summary.currentRuntimeBinding;
  const identity = summary.providerIdentity;
  const hasCanonicalIdentitySource = currentBinding !== null || summary.latestTurn !== null;
  const latestBindingMatchesIdentity = Boolean(
    identity.runtimeBindingId
    && summary.latestRuntimeBinding?.runtimeBindingId === identity.runtimeBindingId,
  );
  const identityBinding = currentBinding ?? (
    !hasCanonicalIdentitySource || latestBindingMatchesIdentity
      ? summary.latestRuntimeBinding
      : null
  );
  const modelId = hasCanonicalIdentitySource
    ? identity.modelId ?? undefined
    : identityBinding?.modelId ?? undefined;
  const providerBindingId = hasCanonicalIdentitySource
    ? identity.providerBindingId ?? undefined
    : identityBinding?.providerBindingId ?? undefined;
  const providerId = hasCanonicalIdentitySource
    ? identity.providerId ?? undefined
    : identityBinding?.providerId ?? undefined;
  const engine = resolveWorkbenchCodeEngineForRuntimeBinding({
    agentId: summary.session.agentId,
    modelId,
    providerBindingId,
    providerId,
  });
  const activity = toAgentSessionActivityView(summary);
  const view = toAgentSessionView(summary.session, {
    projectId,
    engineId: engine?.id ?? providerId,
    modelId,
    providerId,
    providerBindingId,
    runtimeBindingId: currentBinding?.runtimeBindingId,
    hostMode:
      identityBinding?.hostMode === 'desktop' || identityBinding?.hostMode === 'server'
        ? identityBinding.hostMode
        : 'web',
    transportKind: identityBinding?.transportKind,
    providerSessionId: identity.providerSessionId ?? identityBinding?.providerSessionId ?? undefined,
    providerTitle: identityBinding?.providerTitle ?? undefined,
    providerTitleSource: identityBinding?.providerTitleSource ?? undefined,
    providerPreview: identityBinding?.providerPreview ?? undefined,
    providerCreatedAt: identityBinding?.providerCreatedAt ?? undefined,
    providerUpdatedAt: identityBinding?.providerUpdatedAt ?? undefined,
    providerRecencyAt: identityBinding?.providerRecencyAt ?? undefined,
    providerPinned: identityBinding?.providerPinned,
    providerArchived: identityBinding?.providerArchived,
    providerVisible: identityBinding?.providerVisible,
    providerSortKey: identityBinding?.providerSortKey ?? undefined,
    providerSource: identityBinding?.providerSource ?? undefined,
    providerDirectoryVersion: identityBinding?.version,
    runtimeLocationId: identityBinding?.runtimeLocationId ?? undefined,
    runtimeBindingStatus: identityBinding?.status,
    runtimeBindingUpdatedAt: identityBinding?.updatedAt,
    userState: summary.userState,
  });
  const next: AgentSessionView = {
    ...view,
    activity,
    runtimeStatus: resolveAgentSessionActivityRuntimeStatus(activity),
    lastAttentionAt: summary.pendingInteraction?.updatedAt,
    lastRuntimeEventAt:
      readNullableString(summary.providerActivity?.observedAt) ?? identityBinding?.updatedAt,
    lastUserActivityAt: summary.userState?.updatedAt,
    sortTimestamp: String(Date.parse(summary.freshness.activityAt) || 0),
  };
  return {
    ...next,
    displayTime: formatAgentSessionActivityDisplayTime(next),
  };
}

export function mergeAgentSessionRecordIntoView(
  existing: AgentSessionView,
  session: AgentSessionRecord,
): AgentSessionView {
  if (session.projectId?.trim() !== existing.projectId || session.sessionId !== existing.id) {
    throw new Error(`Agents session ${session.sessionId} does not match the loaded Session Inbox entry.`);
  }
  const didAppendItem = session.lastItemSequence !== existing.lastItemSequence;
  const activityAt = session.lastItemAt ?? session.updatedAt;
  const parsedActivityAt = Date.parse(activityAt);
  return {
    ...existing,
    agentId: session.agentId,
    status: resolveSessionStatus(session.status),
    runtimeStatus:
      session.status === 'closed' || session.status === 'archived'
        ? 'completed'
        : didAppendItem && existing.runtimeStatus === 'failed'
          ? 'ready'
          : existing.runtimeStatus,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastItemAt ?? undefined,
    lastMessageAt: session.lastItemAt ?? undefined,
    sortTimestamp: String(Number.isNaN(parsedActivityAt) ? 0 : parsedActivityAt),
    transcriptUpdatedAt: session.lastItemAt ?? null,
    serverVersion: session.version,
    lastItemSequence: session.lastItemSequence,
    unread:
      existing.lastReadItemSequence !== undefined
        ? existing.lastReadItemSequence !== session.lastItemSequence
        : existing.unread,
    archived: session.status === 'archived' || existing.archived,
    displayTime: formatAgentSessionDisplayTime(activityAt, session.createdAt),
  };
}

async function loadAgentSessionAuxiliaryMetadata<T>(
  name: string,
  load: () => Promise<T>,
  signal: AbortSignal | undefined,
  tolerateFailure: boolean,
): Promise<AuxiliaryMetadataResult<T>> {
  try {
    return { failed: false, value: await load() };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    if (!tolerateFailure) {
      throw error;
    }
    console.warn(
      `Failed to load Agents Session ${name}; preserving available transcript data`,
      error,
    );
    return { failed: true, value: null };
  }
}

export async function loadAgentSessionView(
  agentSessionService: IAgentSessionService,
  session: AgentSessionRecord,
  projectId: string,
  items: readonly AgentSessionItemRecord[] = [],
  itemPageInfo?: AgentSessionItemPageInfoView,
  signal?: AbortSignal,
  prefetchedUserStates?: ReadonlyMap<string, AgentSessionUserStateRecord>,
  options: LoadAgentSessionViewOptions = {},
): Promise<AgentSessionView> {
  const tolerateFailure = options.tolerateAuxiliaryMetadataFailure === true;
  const fallbackView = options.fallbackView;
  const [runtimeBindingResult, userStatesResult] = await Promise.all([
    options.reuseFallbackRuntimeMetadata && fallbackView?.activity
      ? Promise.resolve({ failed: true, value: null })
      : loadAgentSessionAuxiliaryMetadata(
          'runtime bindings',
          () => agentSessionService.listRuntimeBindings(
            { agentId: session.agentId, sessionId: session.sessionId },
            { page: 1, pageSize: 20 },
            { signal },
          ),
          signal,
          tolerateFailure,
        ),
    loadAgentSessionAuxiliaryMetadata(
      'user state',
      () => prefetchedUserStates
        ? Promise.resolve(prefetchedUserStates)
        : agentSessionService.getSessionUserStates([
            { agentId: session.agentId, sessionId: session.sessionId },
          ], { signal }),
      signal,
      tolerateFailure,
    ),
  ]);
  const userState = userStatesResult.value?.get(session.sessionId) ?? null;
  const currentBinding = runtimeBindingResult.value?.items.find((binding) => binding.isCurrent);
  const engine = currentBinding
    ? resolveWorkbenchCodeEngineForRuntimeBinding({
        ...currentBinding,
        agentId: session.agentId,
      })
    : null;
  const view = toAgentSessionView(session, {
    projectId,
    engineId: engine?.id
      ?? currentBinding?.providerId
      ?? (runtimeBindingResult.failed ? fallbackView?.engineId : undefined),
    modelId: currentBinding?.modelId
      ?? (runtimeBindingResult.failed ? fallbackView?.modelId : undefined),
    providerId: currentBinding?.providerId
      ?? (runtimeBindingResult.failed ? fallbackView?.providerId : undefined),
    providerBindingId: currentBinding?.providerBindingId
      ?? (runtimeBindingResult.failed ? fallbackView?.providerBindingId : undefined),
    // A failed binding read is not proof that the previous binding is still
    // active. Keep the transcript, but fail closed for Turn admission.
    runtimeBindingId: currentBinding?.runtimeBindingId,
    hostMode:
      currentBinding?.hostMode === 'desktop' || currentBinding?.hostMode === 'server'
        ? currentBinding.hostMode
        : runtimeBindingResult.failed
          ? fallbackView?.hostMode
          : 'web',
    transportKind: currentBinding?.transportKind
      ?? (runtimeBindingResult.failed ? fallbackView?.transportKind : undefined),
    providerSessionId: currentBinding?.providerSessionId
      ?? (runtimeBindingResult.failed ? fallbackView?.providerSessionId : undefined),
    providerTitle: currentBinding?.providerTitle
      ?? (runtimeBindingResult.failed ? fallbackView?.providerTitle : undefined),
    providerTitleSource: currentBinding?.providerTitleSource
      ?? (runtimeBindingResult.failed ? fallbackView?.providerTitleSource : undefined),
    providerPreview: currentBinding?.providerPreview
      ?? (runtimeBindingResult.failed ? fallbackView?.providerPreview : undefined),
    providerCreatedAt: currentBinding?.providerCreatedAt
      ?? (runtimeBindingResult.failed ? fallbackView?.providerCreatedAt : undefined),
    providerUpdatedAt: currentBinding?.providerUpdatedAt
      ?? (runtimeBindingResult.failed ? fallbackView?.providerUpdatedAt : undefined),
    providerRecencyAt: currentBinding?.providerRecencyAt
      ?? (runtimeBindingResult.failed ? fallbackView?.providerRecencyAt : undefined),
    providerPinned: currentBinding?.providerPinned
      ?? (runtimeBindingResult.failed ? fallbackView?.providerPinned : undefined),
    providerArchived: currentBinding?.providerArchived
      ?? (runtimeBindingResult.failed ? fallbackView?.providerArchived : undefined),
    providerVisible: currentBinding?.providerVisible
      ?? (runtimeBindingResult.failed ? fallbackView?.providerVisible : undefined),
    providerSortKey: currentBinding?.providerSortKey
      ?? (runtimeBindingResult.failed ? fallbackView?.providerSortKey : undefined),
    providerSource: currentBinding?.providerSource
      ?? (runtimeBindingResult.failed ? fallbackView?.providerSource : undefined),
    providerDirectoryVersion: currentBinding?.version
      ?? (runtimeBindingResult.failed ? fallbackView?.providerDirectoryVersion : undefined),
    runtimeLocationId: currentBinding?.runtimeLocationId
      ?? (runtimeBindingResult.failed ? fallbackView?.runtimeLocationId : undefined),
    runtimeBindingStatus: currentBinding?.status,
    runtimeBindingUpdatedAt: currentBinding?.updatedAt
      ?? (runtimeBindingResult.failed ? fallbackView?.lastRuntimeEventAt : undefined),
    userState,
    itemPageInfo,
  }, items);
  return inheritAgentSessionItemSourceWindow({
    ...view,
    ...(runtimeBindingResult.failed && fallbackView
      ? {
        lastRuntimeEventAt: fallbackView.lastRuntimeEventAt,
        runtimeStatus:
          view.status === 'completed' || view.status === 'archived'
            ? view.runtimeStatus
            : view.runtimeBindingId
              ? fallbackView.runtimeStatus
              : 'unknown',
      }
      : {}),
    ...(userStatesResult.failed && fallbackView
      ? {
        archived: view.archived || fallbackView.archived,
        lastReadItemSequence: fallbackView.lastReadItemSequence,
        pinned: fallbackView.pinned,
        title: fallbackView.title,
        unread: fallbackView.unread,
      }
      : {}),
  }, view);
}

export async function loadProjectAgentSessionPage(
  agentSessionService: IAgentSessionService,
  project: AgentProjectView,
  requestedCount: number,
  signal?: AbortSignal,
  options: LoadProjectAgentSessionPageOptions = {},
): Promise<ProjectAgentSessionPage> {
  signal?.throwIfAborted();
  const targetCount = normalizeProjectAgentSessionTargetCount(requestedCount);
  const projectId = project.projectId;
  const resetWindow = options.resetWindow === true;
  const currentPageInfo = resetWindow ? undefined : project.agentSessionPageInfo;
  if (
    (currentPageInfo && project.agentSessions.length >= targetCount)
    || (currentPageInfo && !currentPageInfo.hasMore)
  ) {
    return {
      hasMore: project.agentSessions.length > targetCount || currentPageInfo?.hasMore === true,
      hasNewer: currentPageInfo?.hasNewer === true,
      project,
      windowShifted: false,
    };
  }

  const requestedCursor = currentPageInfo?.nextCursor ?? undefined;
  const sessionPage = await agentSessionService.listSessionActivitySummaries({
    cursor: requestedCursor,
    pageSize: PROJECT_SESSION_PAGE_SIZE,
    projectId,
  }, { signal });
  const pageInfo = normalizePageInfo(
    sessionPage.pageInfo,
    requestedCursor,
    PROJECT_SESSION_PAGE_SIZE,
  );
  if (sessionPage.items.length > pageInfo.pageSize) {
    throw new Error('Agents Session activity inventory exceeded its declared page size.');
  }
  if (sessionPage.items.length === 0 && pageInfo.hasMore) {
    throw new Error('Agents Session activity inventory returned an empty page with hasMore=true.');
  }
  const seenSessionIds = new Set<string>();
  const deletedSessionIds = new Set<string>();
  const visibleSessions: AgentSessionView[] = [];
  for (const summary of sessionPage.items) {
    const summaryProjectId = summary.session.projectId?.trim() ?? '';
    const sessionId = summary.session.sessionId.trim();
    if (summaryProjectId !== projectId || !sessionId) {
      throw new Error('Agents Session activity inventory escaped its requested Project scope.');
    }
    if (seenSessionIds.has(sessionId)) {
      throw new Error('Agents Session activity inventory returned a duplicate Session identity.');
    }
    seenSessionIds.add(sessionId);
    if (summary.presentationPhase === 'deleted' || summary.session.deletedAt) {
      deletedSessionIds.add(sessionId);
    } else {
      visibleSessions.push(toAgentSessionViewFromActivitySummary(summary));
    }
  }
  signal?.throwIfAborted();
  const protectedSessions = project.agentSessions.filter((session) => session.items.length > 0);
  const baseSessions = resetWindow ? protectedSessions : project.agentSessions;
  let agentSessions = mergeAgentSessions(baseSessions, visibleSessions)
    .filter((session) => !deletedSessionIds.has(session.id));
  let windowShifted = resetWindow && project.agentSessionPageInfo?.hasNewer === true;
  if (agentSessions.length > PROJECT_STORE_MAX_CACHED_SESSIONS) {
    const protectedSessionsInWindow = agentSessions
      .filter((session) => session.items.length > 0)
      .slice(-PROJECT_STORE_MAX_CACHED_SESSIONS);
    const protectedSessionIds = new Set(
      protectedSessionsInWindow.map((session) => session.id),
    );
    const unprotectedSessions = agentSessions.filter(
      (session) => !protectedSessionIds.has(session.id),
    );
    const unprotectedLimit = Math.max(
      0,
      PROJECT_STORE_MAX_CACHED_SESSIONS - protectedSessionIds.size,
    );
    agentSessions = [
      ...protectedSessionsInWindow,
      ...(unprotectedLimit > 0 ? unprotectedSessions.slice(-unprotectedLimit) : []),
    ];
    windowShifted = true;
  }
  const hasNewer = resetWindow ? false : currentPageInfo?.hasNewer === true || windowShifted;
  const normalizedPageInfo: AgentSessionPageInfoView = {
    ...pageInfo,
    hasNewer,
  };
  return {
    hasMore: agentSessions.length > targetCount || normalizedPageInfo.hasMore,
    hasNewer,
    project: {
      ...project,
      agentSessionPageInfo: normalizedPageInfo,
      agentSessions,
    },
    windowShifted,
  };
}
