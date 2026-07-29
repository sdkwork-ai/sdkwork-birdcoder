import type {
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
import { mergeAgentSessionProjectionForStore } from '../stores/projectsStore.ts';
import { resolveAgentSessionFileChanges } from './agentSessionFileChanges.ts';
import {
  coalesceCodexUserContentResources,
  resolveAgentSessionUserContent,
  type AgentSessionUserContentProjection,
  type AgentSessionUserContentProviderIdentity,
} from './agentSessionUserContent.ts';
import { resolveAgentSessionProviderPayload } from './agentSessionProviderPayload.ts';

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
  runtimeLocationId?: string;
  runtimeBindingStatus?: 'active' | 'deactivated' | 'failed' | 'deleted';
  runtimeBindingUpdatedAt?: string;
  userState?: AgentSessionUserStateRecord | null;
  itemPageInfo?: AgentSessionPageInfoView;
}

export interface ProjectAgentSessionPage {
  hasMore: boolean;
  project: AgentProjectView;
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

const PROJECT_SESSION_PAGE_SIZE = 20;
const PROJECT_SESSION_PAGE_HYDRATION_CONCURRENCY = 6;

export function normalizeProjectAgentSessionTargetCount(requestedCount: number): number {
  if (!Number.isFinite(requestedCount)) {
    return 1;
  }
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(requestedCount)));
}

function normalizePageInfo(
  pageInfo: Awaited<ReturnType<IAgentSessionService['listSessionsByProject']>>['pageInfo'],
  requestedPage: number,
  requestedPageSize: number,
): AgentSessionPageInfoView {
  if (pageInfo.mode !== 'offset') {
    throw new Error('Agents session inventory must use offset pagination.');
  }
  const page = pageInfo.page ?? requestedPage;
  const pageSize = pageInfo.pageSize ?? requestedPageSize;
  if (page !== requestedPage) {
    throw new Error(
      `Agents session inventory returned page ${page} while page ${requestedPage} was requested.`,
    );
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new Error('Agents session inventory returned an invalid page size.');
  }
  return {
    hasMore: pageInfo.hasMore === true,
    page,
    pageSize,
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  worker: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  const workerCount = Math.min(inputs.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(inputs[index]!, index);
    }
  }));
  return results;
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
  'command_execution',
  'compaction',
  'context_window_will_overflow',
  'custom_tool_call',
  'custom_tool_call_output',
  'dynamic_tool_call',
  'file_change',
  'function_call',
  'function_call_output',
  'finished',
  'image_generation',
  'image_generation_call',
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    const envelopeType = readNonEmptyString(envelope.type)
      .toLowerCase()
      .replace(/[./\-\s]+/gu, '_');
    if (PROVIDER_NATIVE_TOOL_TYPES.has(envelopeType)) {
      return record;
    }
  }
  const type = readNonEmptyString(record.type ?? record.method)
    .toLowerCase()
    .replace(/[./\-\s]+/gu, '_');
  return PROVIDER_NATIVE_TOOL_TYPES.has(type) ? record : null;
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
  const completedAt = item.completedAt
    ?? (['completed', 'failed', 'cancelled'].includes(item.status) ? item.updatedAt : undefined);
  const providerPayload = item.kind === 'tool_call' || item.kind === 'tool_result'
    ? resolveAgentSessionProviderPayload(
        [item.toolResult, item.toolArguments],
        {
          completedAt,
          createdAt: item.createdAt,
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
  return {
    ...target,
    role: 'user',
    content,
    metadata: {
      ...target.metadata,
      agentItemKind: 'user_input',
    },
    resources: resources.length > 0 ? resources : undefined,
  };
}

export function toAgentSessionTranscriptItemViews(
  items: readonly AgentSessionItemRecord[],
  providerIdentity?: AgentSessionUserContentProviderIdentity,
): AgentSessionItemView[] {
  const transcriptItems: AgentSessionItemView[] = [];
  for (let index = 0; index < items.length;) {
    const item = items[index]!;
    if (!isCodexUserContentCarrier(item, providerIdentity)) {
      const view = toAgentSessionItemView(item, providerIdentity);
      if (isAgentSessionItemVisibleInTranscript(view)) {
        transcriptItems.push(view);
      }
      index += 1;
      continue;
    }

    let groupEnd = index + 1;
    while (
      groupEnd < items.length
      && isCodexUserContentCarrier(items[groupEnd]!, providerIdentity)
      && hasSameCodexMessageIdentity(item, items[groupEnd]!)
    ) {
      groupEnd += 1;
    }
    const view = mergeCodexUserContentGroup(
      items.slice(index, groupEnd),
      providerIdentity,
    );
    if (isAgentSessionItemVisibleInTranscript(view)) {
      transcriptItems.push(view);
    }
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
  return {
    id: session.sessionId,
    agentId: session.agentId,
    projectId,
    runtimeBindingId: context.runtimeBindingId?.trim() || undefined,
    runtimeLocationId: context.runtimeLocationId,
    title: context.userState?.customTitle?.trim() || session.title?.trim() || 'Untitled session',
    status: resolveSessionStatus(session.status),
    hostMode: context.hostMode ?? 'web',
    engineId: context.engineId?.trim() || context.providerId?.trim() || 'unknown',
    modelId: context.modelId?.trim() || 'auto',
    providerId: context.providerId?.trim() || 'unknown',
    providerBindingId: context.providerBindingId?.trim() || undefined,
    transportKind: context.transportKind?.trim() || undefined,
    providerSessionId: context.providerSessionId?.trim() || undefined,
    runtimeStatus: session.status === 'closed' || session.status === 'archived'
      ? 'completed'
      : context.runtimeBindingStatus === 'failed'
        ? 'failed'
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
  };
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
  itemPageInfo?: AgentSessionPageInfoView,
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
    runtimeBindingId: currentBinding?.runtimeBindingId
      ?? (runtimeBindingResult.failed ? fallbackView?.runtimeBindingId : undefined),
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
    runtimeLocationId: currentBinding?.runtimeLocationId
      ?? (runtimeBindingResult.failed ? fallbackView?.runtimeLocationId : undefined),
    runtimeBindingStatus: currentBinding?.status,
    runtimeBindingUpdatedAt: currentBinding?.updatedAt
      ?? (runtimeBindingResult.failed ? fallbackView?.lastRuntimeEventAt : undefined),
    userState,
    itemPageInfo,
  }, items);
  return {
    ...view,
    ...(runtimeBindingResult.failed && fallbackView
      ? {
        lastRuntimeEventAt: fallbackView.lastRuntimeEventAt,
        runtimeStatus:
          view.status === 'completed' || view.status === 'archived'
            ? view.runtimeStatus
            : fallbackView.runtimeStatus,
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
  };
}

export async function loadProjectAgentSessionPage(
  agentSessionService: IAgentSessionService,
  project: AgentProjectView,
  requestedCount: number,
  signal?: AbortSignal,
): Promise<ProjectAgentSessionPage> {
  signal?.throwIfAborted();
  const targetCount = normalizeProjectAgentSessionTargetCount(requestedCount);
  const projectId = project.projectId;
  const currentPageInfo = project.agentSessionPageInfo;
  if (
    project.agentSessions.length >= targetCount
    || (currentPageInfo && !currentPageInfo.hasMore)
  ) {
    return {
      hasMore: project.agentSessions.length > targetCount || currentPageInfo?.hasMore === true,
      project,
    };
  }

  const requestedPage = currentPageInfo ? currentPageInfo.page + 1 : 1;
  const sessionPage = await agentSessionService.listSessionsByProject({
    page: requestedPage,
    pageSize: PROJECT_SESSION_PAGE_SIZE,
    projectId,
  }, { signal });
  const pageInfo = normalizePageInfo(
    sessionPage.pageInfo,
    requestedPage,
    PROJECT_SESSION_PAGE_SIZE,
  );
  if (sessionPage.items.length > pageInfo.pageSize) {
    throw new Error('Agents session inventory exceeded its declared page size.');
  }
  if (sessionPage.items.length === 0 && pageInfo.hasMore) {
    throw new Error('Agents session inventory returned an empty page with hasMore=true.');
  }
  const projectSessions = sessionPage.items.filter((session) => session.projectId === projectId);
  const userStateSessionIdentities = projectSessions.map((session) => ({
    agentId: session.agentId,
    sessionId: session.sessionId,
  }));
  const userStates = userStateSessionIdentities.length > 0
    ? await agentSessionService.getSessionUserStates(userStateSessionIdentities, { signal })
    : new Map<string, AgentSessionUserStateRecord>();
  const existingSessionsById = new Map(
    project.agentSessions.map((session) => [session.id, session]),
  );
  const visibleSessions = await mapWithConcurrency(
    projectSessions,
    PROJECT_SESSION_PAGE_HYDRATION_CONCURRENCY,
    (session) => {
      const fallbackView = existingSessionsById.get(session.sessionId);
      return loadAgentSessionView(
        agentSessionService,
        session,
        projectId,
        [],
        undefined,
        signal,
        userStates,
        {
          fallbackView,
          reuseFallbackRuntimeMetadata: fallbackView?.activity !== undefined,
        },
      );
    },
  );
  signal?.throwIfAborted();
  const agentSessions = mergeAgentSessions(project.agentSessions, visibleSessions);
  return {
    hasMore: agentSessions.length > targetCount || pageInfo.hasMore,
    project: {
      ...project,
      agentSessionPageInfo: pageInfo,
      agentSessions,
    },
  };
}
