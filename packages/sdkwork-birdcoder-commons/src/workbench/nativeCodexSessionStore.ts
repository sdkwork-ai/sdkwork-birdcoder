import type {
  BirdCoderChatMessage,
  BirdCoderCodingSessionStatus,
  BirdCoderCodingSessionSummary,
  BirdCoderHostMode,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
} from '@sdkwork/birdcoder-types';

interface NodeRuntimeProcess {
  env: NodeJS.ProcessEnv;
  versions?: {
    node?: string;
  };
  getBuiltinModule?: (id: string) => unknown;
}

interface NodeFsStatsLike {
  mtimeMs: number;
  size: number;
}

interface NodeFsDirentLike {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

interface NodeFsModule {
  closeSync(fd: number): void;
  existsSync(path: string): boolean;
  openSync(path: string, flags: string): number;
  readSync(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): number;
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(
    path: string,
    options?: {
      withFileTypes?: boolean;
    },
  ): Array<string | NodeFsDirentLike>;
  statSync(path: string): NodeFsStatsLike;
}

interface NodePathModule {
  basename(path: string): string;
  join(...paths: string[]): string;
}

interface NativeCodexSessionTranscriptEntry {
  content: string;
  commands?: BirdCoderChatMessage['commands'];
  createdAt: string;
  role: BirdCoderChatMessage['role'];
  sourceId?: string;
  turnId?: string;
}

interface NativeCodexSessionEnvelope {
  payload?: unknown;
  timestamp?: unknown;
  type?: unknown;
}

interface NativeCodexEventPayload {
  action?: unknown;
  additional_permissions?: unknown;
  additionalPermissions?: unknown;
  aggregated_output?: unknown;
  agent_statuses?: unknown;
  agentStatuses?: unknown;
  approval_id?: unknown;
  approvalId?: unknown;
  arguments?: unknown;
  available_decisions?: unknown;
  availableDecisions?: unknown;
  call_id?: unknown;
  callId?: unknown;
  changes?: unknown;
  command?: unknown;
  content_items?: unknown;
  contentItems?: unknown;
  cwd?: unknown;
  decision_source?: unknown;
  decisionSource?: unknown;
  error?: unknown;
  exit_code?: unknown;
  id?: unknown;
  invocation?: unknown;
  message?: unknown;
  mcp_app_resource_uri?: unknown;
  mcpAppResourceUri?: unknown;
  model?: unknown;
  network_approval_context?: unknown;
  networkApprovalContext?: unknown;
  new_agent_nickname?: unknown;
  newAgentNickname?: unknown;
  new_agent_role?: unknown;
  newAgentRole?: unknown;
  new_thread_id?: unknown;
  newThreadId?: unknown;
  path?: unknown;
  prompt?: unknown;
  query?: unknown;
  reason?: unknown;
  rationale?: unknown;
  reasoning_effort?: unknown;
  reasoningEffort?: unknown;
  receiver_agent_nickname?: unknown;
  receiverAgentNickname?: unknown;
  receiver_agent_role?: unknown;
  receiverAgentRole?: unknown;
  receiver_agents?: unknown;
  receiverAgents?: unknown;
  receiver_thread_id?: unknown;
  receiverThreadId?: unknown;
  receiver_thread_ids?: unknown;
  receiverThreadIds?: unknown;
  review_output?: unknown;
  reviewOutput?: unknown;
  revised_prompt?: unknown;
  revisedPrompt?: unknown;
  result?: unknown;
  risk_level?: unknown;
  riskLevel?: unknown;
  saved_path?: unknown;
  savedPath?: unknown;
  sender_thread_id?: unknown;
  senderThreadId?: unknown;
  status?: unknown;
  statuses?: unknown;
  stderr?: unknown;
  stdout?: unknown;
  success?: unknown;
  target?: unknown;
  target_item_id?: unknown;
  targetItemId?: unknown;
  text?: unknown;
  tool?: unknown;
  turnId?: unknown;
  turn_id?: unknown;
  type?: unknown;
  user_authorization?: unknown;
  userAuthorization?: unknown;
  user_facing_hint?: unknown;
  userFacingHint?: unknown;
  proposed_execpolicy_amendment?: unknown;
  proposedExecpolicyAmendment?: unknown;
  proposed_network_policy_amendments?: unknown;
  proposedNetworkPolicyAmendments?: unknown;
}

interface NativeCodexMessagePayload {
  content?: unknown;
  role?: unknown;
  turnId?: unknown;
  turn_id?: unknown;
  type?: unknown;
}

interface NativeCodexSessionIndexPayload {
  id?: unknown;
  thread_name?: unknown;
  updated_at?: unknown;
}

interface NativeCodexSessionIndexEntry {
  threadName: string | null;
  updatedAt: string | null;
}

interface NativeCodexSessionIndexCacheEntry {
  entries: Map<string, NativeCodexSessionIndexEntry>;
  filePath: string;
  modifiedAtMs: number;
}

interface NativeCodexSessionSummaryCacheEntry {
  fileModifiedAtMs: number;
  filePath: string;
  fileSize: number;
  sessionIndexThreadName: string | null;
  sessionIndexUpdatedAt: string | null;
  summary: StoredCodingSessionInventoryRecord;
}

interface NativeCodexSessionResolvedFields {
  createdAt: string | null;
  fallbackTitle: string | null;
  hasError: boolean;
  hasTaskComplete: boolean;
  hasTaskStarted: boolean;
  hasTurnAborted: boolean;
  latestTranscriptMessageTimestamp: string | null;
  latestTimestamp: string | null;
  latestUserTimestamp: string | null;
  previousTranscriptEntry: NativeCodexSessionTranscriptEntry | null;
  nativeSessionId: string | null;
  nativeWorkingDirectory: string | null;
  resolvedTitle: string | null;
}

export interface StoredCodingSessionInventoryRecord extends BirdCoderCodingSessionSummary {
  kind: 'coding';
  nativeCwd?: string | null;
  sortTimestamp: number;
  transcriptUpdatedAt?: string | null;
}

export interface NativeCodexSessionRecord {
  filePath: string;
  messages: BirdCoderChatMessage[];
  summary: StoredCodingSessionInventoryRecord;
}

const ZERO_TIMESTAMP = new Date(0).toISOString();
const CODEX_NATIVE_SESSION_ID_PREFIX = 'codex-native:';
const CODEX_SESSION_FILE_EXTENSION = '.jsonl';
const CODING_SESSION_STATUS_SET = new Set<string>(BIRDCODER_CODING_SESSION_STATUSES);
const HOST_MODE_SET = new Set<string>(BIRDCODER_HOST_MODES);
const NATIVE_CODEX_SUMMARY_SMALL_FILE_THRESHOLD_BYTES = 64 * 1024;
const NATIVE_CODEX_SUMMARY_HEAD_READ_BYTES = 32 * 1024;
const NATIVE_CODEX_SUMMARY_TAIL_READ_BYTES = 128 * 1024;
const NATIVE_CODEX_SUMMARY_HEAD_LINE_LIMIT = 240;
const NATIVE_CODEX_SUMMARY_TAIL_LINE_LIMIT = 400;
const NATIVE_CODEX_REVIEW_FALLBACK_MESSAGE = 'Reviewer failed to output a response.';
let nativeCodexSessionIndexCache: NativeCodexSessionIndexCacheEntry | null = null;
const nativeCodexSessionSummaryCache = new Map<string, NativeCodexSessionSummaryCacheEntry>();

function getRuntimeProcess(): NodeRuntimeProcess | null {
  const runtime = globalThis as typeof globalThis & {
    process?: NodeRuntimeProcess;
  };
  return runtime.process ?? null;
}

function isNodeRuntime(): boolean {
  return Boolean(getRuntimeProcess()?.versions?.node);
}

function getBuiltinModule<T>(id: string): T | null {
  return getRuntimeProcess()?.getBuiltinModule?.(id) as T | null;
}

function getFsModule(): NodeFsModule | null {
  return isNodeRuntime() ? getBuiltinModule<NodeFsModule>('node:fs') : null;
}

function getPathModule(): NodePathModule | null {
  return isNodeRuntime() ? getBuiltinModule<NodePathModule>('node:path') : null;
}

function resolveIsoTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function normalizeOptionalIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function normalizeCodingSessionStatus(value: unknown): BirdCoderCodingSessionStatus {
  return typeof value === 'string' && CODING_SESSION_STATUS_SET.has(value)
    ? value as BirdCoderCodingSessionStatus
    : 'draft';
}

function normalizeHostMode(value: unknown): BirdCoderHostMode {
  return typeof value === 'string' && HOST_MODE_SET.has(value)
    ? value as BirdCoderHostMode
    : 'desktop';
}

function toIsoTimestampFromMilliseconds(value: number): string {
  return Number.isFinite(value) && value > 0
    ? new Date(value).toISOString()
    : ZERO_TIMESTAMP;
}

function truncateSessionTitle(value: string, limit = 120): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(limit - 3, 1)).trimEnd()}...`;
}

function stripCodexControlTags(value: string): string {
  return value
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gu, ' ')
    .replace(/<turn_aborted>[\s\S]*?<\/turn_aborted>/gu, ' ')
    .trim();
}

function normalizeCodexPromptText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = stripCodexControlTags(value).replace(/\s+/gu, ' ').trim();
  if (!normalizedValue) {
    return null;
  }

  return truncateSessionTitle(normalizedValue);
}

function normalizeCodexMessageText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = stripCodexControlTags(value);
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeCodexWorkingDirectoryPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.replace(/[\\/]+$/u, '').trim();
  return normalizedValue || null;
}

function normalizeCodexWorkingDirectoryTitle(
  value: unknown,
  pathModule: NodePathModule | null,
): string | null {
  const normalizedWorkingDirectory = normalizeCodexWorkingDirectoryPath(value);
  if (!normalizedWorkingDirectory || !pathModule) {
    return null;
  }

  const basename = pathModule.basename(normalizedWorkingDirectory).trim();
  return basename || null;
}

function normalizeNativeCodexSessionId(
  value: unknown,
  fallbackFilePath: string,
  pathModule: NodePathModule | null,
): string {
  if (typeof value === 'string' && value.trim()) {
    return `${CODEX_NATIVE_SESSION_ID_PREFIX}${value.trim()}`;
  }

  const fallbackName = pathModule?.basename(fallbackFilePath) ?? fallbackFilePath;
  return `${CODEX_NATIVE_SESSION_ID_PREFIX}${fallbackName.replace(/\.jsonl$/iu, '')}`;
}

function normalizeNativeTurnId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeNativeCodexSourceId(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalizedValue = normalizeNativeTurnId(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return undefined;
}

function normalizeNativeCodexSessionIndexId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
}

function normalizeNativeCodexSessionIndexTitle(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.replace(/\s+/gu, ' ').trim();
  return normalizedValue ? truncateSessionTitle(normalizedValue) : null;
}

function resolveCodexHomeDirectory(): string | null {
  const runtimeProcess = getRuntimeProcess();
  const pathModule = getPathModule();
  if (!runtimeProcess || !pathModule) {
    return null;
  }

  const configuredCodexHome = runtimeProcess.env.CODEX_HOME?.trim();
  if (configuredCodexHome) {
    return configuredCodexHome;
  }

  const homeDirectory =
    runtimeProcess.env.HOME?.trim() ||
    runtimeProcess.env.USERPROFILE?.trim();
  return homeDirectory
    ? pathModule.join(homeDirectory, '.codex')
    : null;
}

function listCodexSessionFiles(
  sessionsDirectory: string,
  fsModule: NodeFsModule,
  pathModule: NodePathModule,
): string[] {
  const sessionFiles: string[] = [];
  const pendingDirectories = [sessionsDirectory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let directoryEntries: Array<string | NodeFsDirentLike> = [];
    try {
      directoryEntries = fsModule.readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of directoryEntries) {
      if (!entry || typeof entry === 'string') {
        continue;
      }

      const absolutePath = pathModule.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(CODEX_SESSION_FILE_EXTENSION)) {
        sessionFiles.push(absolutePath);
      }
    }
  }

  return sessionFiles.sort((left, right) => right.localeCompare(left));
}

function readNativeCodexSessionIndexEntries(
  codexHomeDirectory: string,
  fsModule: NodeFsModule,
  pathModule: NodePathModule,
): Map<string, NativeCodexSessionIndexEntry> {
  const sessionIndexEntries = new Map<string, NativeCodexSessionIndexEntry>();
  const sessionIndexPath = pathModule.join(codexHomeDirectory, 'session_index.jsonl');
  if (!fsModule.existsSync(sessionIndexPath)) {
    if (nativeCodexSessionIndexCache?.filePath === sessionIndexPath) {
      nativeCodexSessionIndexCache = null;
    }
    return sessionIndexEntries;
  }

  let sessionIndexModifiedAtMs = 0;
  try {
    sessionIndexModifiedAtMs = fsModule.statSync(sessionIndexPath).mtimeMs;
  } catch {
    sessionIndexModifiedAtMs = 0;
  }

  if (
    nativeCodexSessionIndexCache?.filePath === sessionIndexPath &&
    nativeCodexSessionIndexCache.modifiedAtMs === sessionIndexModifiedAtMs
  ) {
    return nativeCodexSessionIndexCache.entries;
  }

  let rawSessionIndex = '';
  try {
    rawSessionIndex = fsModule.readFileSync(sessionIndexPath, 'utf8');
  } catch {
    return sessionIndexEntries;
  }

  for (const line of rawSessionIndex.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    let payload: NativeCodexSessionIndexPayload | null = null;
    try {
      payload = JSON.parse(trimmedLine) as NativeCodexSessionIndexPayload;
    } catch {
      payload = null;
    }

    if (!payload) {
      continue;
    }

    const nativeSessionId = normalizeNativeCodexSessionIndexId(payload.id);
    if (!nativeSessionId) {
      continue;
    }

    sessionIndexEntries.set(nativeSessionId, {
      threadName: normalizeNativeCodexSessionIndexTitle(payload.thread_name),
      updatedAt: normalizeOptionalIsoTimestamp(payload.updated_at),
    });
  }

  nativeCodexSessionIndexCache = {
    entries: sessionIndexEntries,
    filePath: sessionIndexPath,
    modifiedAtMs: sessionIndexModifiedAtMs,
  };

  return sessionIndexEntries;
}

function resolveMoreRecentIsoTimestamp(
  currentValue: string | null,
  candidateValue: string | null,
): string | null {
  return resolveIsoTimestamp(candidateValue) > resolveIsoTimestamp(currentValue)
    ? candidateValue
    : currentValue;
}

function extractNativeCodexLookupId(codingSessionId: string): string | null {
  if (!codingSessionId.startsWith(CODEX_NATIVE_SESSION_ID_PREFIX)) {
    return null;
  }

  const nativeSessionId = codingSessionId.slice(CODEX_NATIVE_SESSION_ID_PREFIX.length).trim();
  return nativeSessionId || null;
}

function matchesNativeCodexSessionFileName(
  filePath: string,
  nativeSessionId: string,
  pathModule: NodePathModule,
): boolean {
  const normalizedFileName = pathModule.basename(filePath).toLowerCase();
  const normalizedSessionId = nativeSessionId.toLowerCase();
  return (
    normalizedFileName === `${normalizedSessionId}${CODEX_SESSION_FILE_EXTENSION}` ||
    normalizedFileName.endsWith(`-${normalizedSessionId}${CODEX_SESSION_FILE_EXTENSION}`)
  );
}

function readNativeCodexSessionFileSlice(
  filePath: string,
  fsModule: NodeFsModule,
  position: number,
  length: number,
): string | null {
  if (!Number.isFinite(position) || !Number.isFinite(length) || length <= 0) {
    return '';
  }

  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = fsModule.openSync(filePath, 'r');
    const buffer = Buffer.alloc(length);
    const bytesRead = fsModule.readSync(
      fileDescriptor,
      buffer,
      0,
      length,
      Math.max(0, position),
    );
    return buffer.subarray(0, Math.max(bytesRead, 0)).toString('utf8');
  } catch {
    return null;
  } finally {
    if (fileDescriptor !== null) {
      try {
        fsModule.closeSync(fileDescriptor);
      } catch {
        // Ignore close failures because the caller only needs best-effort summary parsing.
      }
    }
  }
}

function readNativeCodexSummaryHeadLines(
  filePath: string,
  fileSize: number,
  fsModule: NodeFsModule,
): string[] {
  const chunkLength = Math.min(
    Math.max(fileSize, 0),
    NATIVE_CODEX_SUMMARY_HEAD_READ_BYTES,
  );
  const chunk = readNativeCodexSessionFileSlice(filePath, fsModule, 0, chunkLength);
  if (!chunk) {
    return [];
  }

  const completeChunk =
    fileSize <= chunkLength || chunk.endsWith('\n')
      ? chunk
      : chunk.slice(0, Math.max(chunk.lastIndexOf('\n'), 0));

  return completeChunk
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, NATIVE_CODEX_SUMMARY_HEAD_LINE_LIMIT);
}

function readNativeCodexSummaryTailLines(
  filePath: string,
  fileSize: number,
  fsModule: NodeFsModule,
): string[] {
  const chunkLength = Math.min(
    Math.max(fileSize, 0),
    NATIVE_CODEX_SUMMARY_TAIL_READ_BYTES,
  );
  const chunkStart = Math.max(fileSize - chunkLength, 0);
  const chunk = readNativeCodexSessionFileSlice(filePath, fsModule, chunkStart, chunkLength);
  if (!chunk) {
    return [];
  }

  const rawLines = chunk.split(/\r?\n/u);
  const completeLines =
    chunkStart > 0
      ? rawLines.slice(1)
      : rawLines;

  return completeLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-NATIVE_CODEX_SUMMARY_TAIL_LINE_LIMIT);
}

function extractCodexResponseItemText(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const textParts = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return normalizeCodexMessageText((item as { text?: unknown }).text);
    })
    .filter((candidate): candidate is string => candidate !== null);

  if (textParts.length === 0) {
    return null;
  }

  return textParts.join('\n\n').trim();
}

function normalizeCodexCommandText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const commandParts = value
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter((part) => part.length > 0);

    return commandParts.length > 0 ? commandParts.join(' ') : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeCodexCommandStatus(
  value: unknown,
): NonNullable<BirdCoderChatMessage['commands']>[number]['status'] {
  switch (typeof value === 'string' ? value.trim().toLowerCase() : '') {
    case 'completed':
    case 'success':
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'error':
    case 'aborted':
    case 'denied':
    case 'timed_out':
    case 'timed-out':
      return 'error';
    default:
      return 'running';
  }
}

function createNativeCodexCommandEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedCommand = normalizeCodexCommandText(payload.command);
  const normalizedOutput = normalizeCodexMessageText(payload.aggregated_output);
  const normalizedExitCode =
    typeof payload.exit_code === 'number' && Number.isFinite(payload.exit_code)
      ? payload.exit_code
      : null;

  if (!normalizedCommand && !normalizedOutput) {
    return null;
  }

  const commandStatus =
    typeof payload.status === 'string' && payload.status.trim().length > 0
      ? normalizeCodexCommandStatus(payload.status)
      : normalizedExitCode === null
        ? 'running'
        : normalizedExitCode === 0
          ? 'success'
          : 'error';
  const commandContent =
    normalizedCommand ??
    (normalizedExitCode !== null
      ? `Command exited with code ${normalizedExitCode}`
      : 'Command execution');

  return {
    content: commandContent,
    commands: [
      {
        command: normalizedCommand ?? commandContent,
        status: commandStatus,
        output: normalizedOutput,
      },
    ],
    createdAt: envelopeTimestamp,
    role: 'tool',
    sourceId:
      normalizeNativeTurnId(payload.call_id) ??
      normalizeNativeTurnId(payload.callId),
    turnId:
      normalizeNativeTurnId(payload.turnId) ??
      normalizeNativeTurnId(payload.turn_id),
  };
}

function createNativeCodexExecApprovalEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedCommand = normalizeCodexCommandText(payload.command);
  const normalizedReason = normalizeCodexMessageText(payload.reason);
  const normalizedWorkingDirectory = normalizeCodexWorkingDirectoryPath(payload.cwd);
  const normalizedSuggestedAllowRule = normalizeCodexCommandText(
    normalizeNativeCodexRecord(
      payload.proposed_execpolicy_amendment ?? payload.proposedExecpolicyAmendment,
    )?.command,
  );
  const decisionLabels = normalizeNativeCodexReviewDecisionLabels(
    payload.available_decisions ?? payload.availableDecisions,
  );
  const outputLines: string[] = [];
  if (normalizedReason) {
    outputLines.push(`Reason: ${normalizedReason}`);
  }
  if (normalizedWorkingDirectory) {
    outputLines.push(`Working directory: ${normalizedWorkingDirectory}`);
  }
  if (normalizedSuggestedAllowRule) {
    outputLines.push(`Suggested allow rule: ${normalizedSuggestedAllowRule}`);
  }
  if (decisionLabels.length > 0) {
    outputLines.push(`Available decisions: ${decisionLabels.join('; ')}`);
  }

  return buildNativeCodexCommandLifecycleEntry(envelopeTimestamp, {
    command: normalizedCommand,
    commandStatus: 'running',
    contentPrefix: 'Command approval required',
    outputLines,
    sourceId: normalizeNativeCodexSourceId(payload.call_id, payload.callId),
    turnId: normalizeNativeCodexSourceId(payload.turnId, payload.turn_id),
  });
}

function createNativeCodexGuardianAssessmentEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedStatus = normalizeNativeCodexActionType(payload.status);
  const projection =
    normalizedStatus === 'in_progress'
      ? {
          commandStatus: 'running' as const,
          contentPrefix: 'Command approval in review',
        }
      : normalizedStatus === 'denied'
        ? {
            commandStatus: 'error' as const,
            contentPrefix: 'Command approval denied',
          }
        : normalizedStatus === 'aborted'
          ? {
              commandStatus: 'error' as const,
              contentPrefix: 'Command approval aborted',
            }
          : normalizedStatus === 'timed_out'
            ? {
                commandStatus: 'error' as const,
                contentPrefix: 'Command approval timed out',
              }
            : null;
  if (!projection) {
    return null;
  }

  const normalizedAction = normalizeNativeCodexGuardianAction(payload.action);
  if (!normalizedAction?.command) {
    return null;
  }

  const normalizedRationale = normalizeCodexMessageText(payload.rationale);
  const normalizedRiskLevel = normalizeNativeCodexActionType(
    payload.risk_level ?? payload.riskLevel,
  );
  const normalizedUserAuthorization = normalizeNativeCodexActionType(
    payload.user_authorization ?? payload.userAuthorization,
  );
  const outputLines: string[] = [];
  if (normalizedRationale) {
    outputLines.push(`Rationale: ${normalizedRationale}`);
  }
  if (normalizedRiskLevel) {
    outputLines.push(`Risk level: ${normalizedRiskLevel.replace(/_/gu, ' ')}`);
  }
  if (normalizedUserAuthorization) {
    outputLines.push(`User authorization: ${normalizedUserAuthorization.replace(/_/gu, ' ')}`);
  }

  return buildNativeCodexCommandLifecycleEntry(envelopeTimestamp, {
    command: normalizedAction.command,
    commandStatus: projection.commandStatus,
    contentPrefix: projection.contentPrefix,
    outputLines,
    sourceId: normalizeNativeCodexSourceId(
      payload.target_item_id,
      payload.targetItemId,
      payload.call_id,
      payload.callId,
      payload.id,
    ),
    turnId: normalizeNativeCodexSourceId(payload.turnId, payload.turn_id),
  });
}

function createNativeCodexEnteredReviewModeEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry {
  return {
    content:
      normalizeCodexMessageText(payload.user_facing_hint ?? payload.userFacingHint) ??
      'Review requested.',
    createdAt: envelopeTimestamp,
    role: 'reviewer',
    turnId: normalizeNativeCodexSourceId(payload.turnId, payload.turn_id),
  };
}

function createNativeCodexExitedReviewModeEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry {
  const normalizedReviewOutput = normalizeNativeCodexRecord(
    payload.review_output ?? payload.reviewOutput,
  );
  const normalizedExplanation = normalizeCodexMessageText(
    normalizedReviewOutput?.overall_explanation ?? normalizedReviewOutput?.overallExplanation,
  );

  return {
    content: normalizedExplanation ?? NATIVE_CODEX_REVIEW_FALLBACK_MESSAGE,
    createdAt: envelopeTimestamp,
    role: 'reviewer',
    turnId: normalizeNativeCodexSourceId(payload.turnId, payload.turn_id),
  };
}

function createNativeCodexReasoningEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedReasoning = normalizeCodexMessageText(payload.text);
  if (!normalizedReasoning) {
    return null;
  }

  return {
    content: normalizedReasoning,
    createdAt: envelopeTimestamp,
    role: 'planner',
    turnId:
      normalizeNativeTurnId(payload.turnId) ??
      normalizeNativeTurnId(payload.turn_id),
  };
}

function normalizeNativeCodexActionType(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeNativeCodexStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

function normalizeNativeCodexRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function stringifyNativeCodexJsonValue(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  try {
    const serializedValue = JSON.stringify(value);
    return typeof serializedValue === 'string' && serializedValue.length > 0
      ? serializedValue
      : null;
  } catch {
    return null;
  }
}

function normalizeNativeCodexNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeNativeCodexReviewDecisionLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return normalizeNativeCodexActionType(entry);
      }

      const normalizedEntry = normalizeNativeCodexRecord(entry);
      return normalizeNativeCodexActionType(normalizedEntry?.type);
    })
    .filter((entry): entry is string => entry !== null);
}

function normalizeNativeCodexGuardianAction(
  value: unknown,
): {
  command: string | null;
  cwd: string | null;
} | null {
  const normalizedAction = normalizeNativeCodexRecord(value);
  if (!normalizedAction) {
    return null;
  }

  const normalizedActionType = normalizeNativeCodexActionType(normalizedAction.type);
  if (normalizedActionType === 'command') {
    return {
      command: normalizeCodexMessageText(normalizedAction.command),
      cwd: normalizeCodexWorkingDirectoryPath(normalizedAction.cwd),
    };
  }
  if (normalizedActionType === 'execve') {
    return {
      command:
        normalizeCodexCommandText(normalizedAction.argv) ??
        normalizeCodexMessageText(normalizedAction.program),
      cwd: normalizeCodexWorkingDirectoryPath(normalizedAction.cwd),
    };
  }

  return null;
}

function buildNativeCodexCommandLifecycleEntry(
  envelopeTimestamp: string,
  options: {
    command: string | null;
    commandStatus: NonNullable<BirdCoderChatMessage['commands']>[number]['status'];
    contentPrefix: string;
    outputLines?: string[];
    sourceId?: string;
    turnId?: string;
  },
): NativeCodexSessionTranscriptEntry | null {
  if (!options.command) {
    return null;
  }

  const normalizedOutput = options.outputLines?.filter((line) => line.trim().length > 0) ?? [];

  return {
    content: `${options.contentPrefix}: ${options.command}`,
    commands: [
      {
        command: options.command,
        status: options.commandStatus,
        output: normalizedOutput.length > 0 ? normalizedOutput.join('\n') : undefined,
      },
    ],
    createdAt: envelopeTimestamp,
    role: 'tool',
    sourceId: options.sourceId,
    turnId: options.turnId,
  };
}

function buildNativeCodexToolEntry(
  envelopeTimestamp: string,
  options: {
    contentLines: string[];
    payload: NativeCodexEventPayload;
  },
): NativeCodexSessionTranscriptEntry | null {
  if (options.contentLines.length === 0) {
    return null;
  }

  return {
    content: options.contentLines.join('\n'),
    createdAt: envelopeTimestamp,
    role: 'tool',
    sourceId:
      normalizeNativeTurnId(options.payload.call_id) ??
      normalizeNativeTurnId(options.payload.callId),
    turnId:
      normalizeNativeTurnId(options.payload.turnId) ??
      normalizeNativeTurnId(options.payload.turn_id),
  };
}

function createNativeCodexWebSearchEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedQuery = normalizeCodexMessageText(payload.query);
  const action =
    payload.action && typeof payload.action === 'object' && !Array.isArray(payload.action)
      ? payload.action as {
          pattern?: unknown;
          queries?: unknown;
          query?: unknown;
          type?: unknown;
          url?: unknown;
        }
      : null;
  const normalizedActionType = normalizeNativeCodexActionType(action?.type);
  const normalizedActionQuery = normalizeCodexMessageText(action?.query);
  const normalizedActionQueries = normalizeNativeCodexStringArray(action?.queries);
  const normalizedActionUrl = normalizeCodexMessageText(action?.url);
  const normalizedActionPattern = normalizeCodexMessageText(action?.pattern);

  const contentLines = ['Web search completed:'];
  if (normalizedQuery) {
    contentLines.push(`Query: ${normalizedQuery}`);
  }
  if (normalizedActionType) {
    contentLines.push(`Action: ${normalizedActionType.replace(/_/gu, ' ')}`);
  }
  if (normalizedActionType === 'search' && normalizedActionQueries.length > 0) {
    contentLines.push(`Queries: ${normalizedActionQueries.join('; ')}`);
  }
  if (
    normalizedActionQuery &&
    normalizedActionQuery !== normalizedQuery &&
    normalizedActionType !== 'search'
  ) {
    contentLines.push(`Action query: ${normalizedActionQuery}`);
  }
  if (normalizedActionUrl) {
    contentLines.push(`URL: ${normalizedActionUrl}`);
  }
  if (normalizedActionPattern) {
    contentLines.push(`Pattern: ${normalizedActionPattern}`);
  }

  if (contentLines.length === 1) {
    return null;
  }

  return {
    content: contentLines.join('\n'),
    createdAt: envelopeTimestamp,
    role: 'tool',
    sourceId:
      normalizeNativeTurnId(payload.call_id) ??
      normalizeNativeTurnId(payload.callId),
    turnId:
      normalizeNativeTurnId(payload.turnId) ??
      normalizeNativeTurnId(payload.turn_id),
  };
}

function normalizeNativeCodexDynamicToolContentLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const normalizedEntry = normalizeNativeCodexRecord(entry);
    if (!normalizedEntry) {
      const serializedEntry = stringifyNativeCodexJsonValue(entry);
      return serializedEntry ? [`Content: ${serializedEntry}`] : [];
    }

    const normalizedType = normalizeNativeCodexActionType(normalizedEntry.type);
    const normalizedText = normalizeCodexMessageText(normalizedEntry.text);
    const normalizedImageUrl = normalizeCodexMessageText(
      normalizedEntry.image_url ?? normalizedEntry.imageUrl,
    );
    if (normalizedText && (normalizedType === 'inputtext' || normalizedType === 'text')) {
      return [`Output: ${normalizedText}`];
    }
    if (normalizedImageUrl && (normalizedType === 'inputimage' || normalizedType === 'image')) {
      return [`Image: ${normalizedImageUrl}`];
    }

    const serializedEntry = stringifyNativeCodexJsonValue(entry);
    return serializedEntry ? [`Content: ${serializedEntry}`] : [];
  });
}

function buildNativeCodexDynamicToolEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
  statusLabel: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedTool = normalizeCodexMessageText(payload.tool);
  const normalizedArguments = stringifyNativeCodexJsonValue(payload.arguments);
  const normalizedOutputs = normalizeNativeCodexDynamicToolContentLines(
    payload.content_items ?? payload.contentItems,
  );
  const normalizedError = normalizeCodexMessageText(payload.error);

  const contentLines = [
    normalizedTool ? `${statusLabel}: ${normalizedTool}` : statusLabel,
  ];
  if (normalizedArguments) {
    contentLines.push(`Arguments: ${normalizedArguments}`);
  }
  contentLines.push(...normalizedOutputs);
  if (normalizedError) {
    contentLines.push(`Error: ${normalizedError}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexDynamicToolRequestEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexDynamicToolEntry(payload, envelopeTimestamp, 'Dynamic tool running');
}

function createNativeCodexDynamicToolResponseEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const statusLabel = payload.success === false
    ? 'Dynamic tool failed'
    : 'Dynamic tool completed';
  return buildNativeCodexDynamicToolEntry(payload, envelopeTimestamp, statusLabel);
}

function normalizeNativeCodexMcpInvocation(
  value: unknown,
): {
  arguments: unknown;
  server: string | null;
  tool: string | null;
} | null {
  const invocation = normalizeNativeCodexRecord(value);
  if (!invocation) {
    return null;
  }

  return {
    arguments: invocation.arguments,
    server: normalizeCodexMessageText(invocation.server),
    tool: normalizeCodexMessageText(invocation.tool),
  };
}

function normalizeNativeCodexMcpResultRecord(value: unknown): Record<string, unknown> | null {
  const normalizedValue = normalizeNativeCodexRecord(value);
  if (!normalizedValue) {
    return null;
  }

  if (normalizeNativeCodexRecord(normalizedValue.Ok)) {
    return normalizeNativeCodexRecord(normalizedValue.Ok);
  }
  if (normalizeNativeCodexRecord(normalizedValue.ok)) {
    return normalizeNativeCodexRecord(normalizedValue.ok);
  }
  if (
    Array.isArray(normalizedValue.content) ||
    normalizedValue.structured_content !== undefined ||
    normalizedValue.structuredContent !== undefined
  ) {
    return normalizedValue;
  }

  return null;
}

function normalizeNativeCodexMcpError(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue || null;
  }

  const normalizedValue = normalizeNativeCodexRecord(value);
  if (!normalizedValue) {
    return null;
  }

  if (typeof normalizedValue.Err === 'string' && normalizedValue.Err.trim()) {
    return normalizedValue.Err.trim();
  }
  if (typeof normalizedValue.err === 'string' && normalizedValue.err.trim()) {
    return normalizedValue.err.trim();
  }
  if (typeof normalizedValue.error === 'string' && normalizedValue.error.trim()) {
    return normalizedValue.error.trim();
  }

  return null;
}

function normalizeNativeCodexMcpContentLines(value: unknown): string[] {
  const normalizedResult = normalizeNativeCodexMcpResultRecord(value);
  if (!normalizedResult) {
    return [];
  }

  const contentLines: string[] = [];
  if (Array.isArray(normalizedResult.content)) {
    for (const contentItem of normalizedResult.content) {
      const normalizedContentItem = normalizeNativeCodexRecord(contentItem);
      const normalizedText = normalizeCodexMessageText(
        normalizedContentItem?.text ?? contentItem,
      );
      if (normalizedText) {
        contentLines.push(`Output: ${normalizedText}`);
        continue;
      }

      const serializedContentItem = stringifyNativeCodexJsonValue(contentItem);
      if (serializedContentItem) {
        contentLines.push(`Content: ${serializedContentItem}`);
      }
    }
  }

  const normalizedStructuredContent = stringifyNativeCodexJsonValue(
    normalizedResult.structured_content ?? normalizedResult.structuredContent,
  );
  if (normalizedStructuredContent) {
    contentLines.push(`Structured content: ${normalizedStructuredContent}`);
  }

  return contentLines;
}

function buildNativeCodexMcpToolEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
  statusLabel: string,
): NativeCodexSessionTranscriptEntry | null {
  const invocation = normalizeNativeCodexMcpInvocation(payload.invocation);
  const normalizedResourceUri = normalizeCodexMessageText(
    payload.mcp_app_resource_uri ?? payload.mcpAppResourceUri,
  );
  const normalizedArguments = stringifyNativeCodexJsonValue(invocation?.arguments);
  const normalizedError = normalizeNativeCodexMcpError(payload.result);
  const normalizedResultLines = normalizeNativeCodexMcpContentLines(payload.result);

  const toolIdentifier = invocation?.server && invocation.tool
    ? `${invocation.server}/${invocation.tool}`
    : invocation?.tool ?? invocation?.server ?? null;
  const contentLines = [
    toolIdentifier ? `${statusLabel}: ${toolIdentifier}` : statusLabel,
  ];
  if (normalizedArguments) {
    contentLines.push(`Arguments: ${normalizedArguments}`);
  }
  if (normalizedResourceUri) {
    contentLines.push(`Resource: ${normalizedResourceUri}`);
  }
  contentLines.push(...normalizedResultLines);
  if (normalizedError) {
    contentLines.push(`Error: ${normalizedError}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexMcpToolBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexMcpToolEntry(payload, envelopeTimestamp, 'MCP tool running');
}

function createNativeCodexMcpToolEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedError = normalizeNativeCodexMcpError(payload.result);
  return buildNativeCodexMcpToolEntry(
    payload,
    envelopeTimestamp,
    normalizedError ? 'MCP tool failed' : 'MCP tool completed',
  );
}

function createNativeCodexViewImageEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedPath = normalizeCodexMessageText(payload.path);
  if (!normalizedPath) {
    return null;
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines: [`Viewed image: ${normalizedPath}`],
    payload,
  });
}

function buildNativeCodexImageGenerationEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
  statusLabel: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedPrompt = normalizeCodexMessageText(
    payload.revised_prompt ?? payload.revisedPrompt,
  );
  const normalizedResult = normalizeCodexMessageText(payload.result);
  const normalizedSavedPath = normalizeCodexMessageText(
    payload.saved_path ?? payload.savedPath,
  );

  const contentLines = [statusLabel];
  if (normalizedPrompt) {
    contentLines.push(`Prompt: ${normalizedPrompt}`);
  }
  if (normalizedResult) {
    contentLines.push(`Result: ${normalizedResult}`);
  }
  if (normalizedSavedPath) {
    contentLines.push(`Saved path: ${normalizedSavedPath}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexImageGenerationBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexImageGenerationEntry(
    payload,
    envelopeTimestamp,
    'Image generation running',
  );
}

function createNativeCodexImageGenerationEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedStatus = normalizeNativeCodexActionType(payload.status) ?? 'completed';
  return buildNativeCodexImageGenerationEntry(
    payload,
    envelopeTimestamp,
    `Image generation ${normalizedStatus.replace(/_/gu, ' ')}`,
  );
}

interface NativeCodexCollabAgentStatusSummary {
  isError: boolean;
  label: string;
  message: string | null;
}

interface NativeCodexCollabAgentSummary {
  nickname: string | null;
  role: string | null;
  status: NativeCodexCollabAgentStatusSummary | null;
  threadId: string | null;
}

function normalizeNativeCodexCollabAgentStatus(
  value: unknown,
): NativeCodexCollabAgentStatusSummary | null {
  const normalizedStatus = normalizeNativeCodexNonEmptyString(value);
  if (normalizedStatus) {
    const normalizedLabel = normalizedStatus.replace(/_/gu, ' ');
    return {
      isError: normalizedStatus === 'not_found',
      label: normalizedLabel,
      message: null,
    };
  }

  const normalizedRecord = normalizeNativeCodexRecord(value);
  if (!normalizedRecord) {
    return null;
  }

  if (Object.hasOwn(normalizedRecord, 'completed')) {
    return {
      isError: false,
      label: 'completed',
      message: normalizeCodexMessageText(normalizedRecord.completed),
    };
  }
  if (Object.hasOwn(normalizedRecord, 'errored')) {
    return {
      isError: true,
      label: 'errored',
      message: normalizeCodexMessageText(normalizedRecord.errored),
    };
  }

  return null;
}

function formatNativeCodexCollabAgentDisplayName(
  nickname: string | null,
  role: string | null,
): string | null {
  if (nickname && role) {
    return `${nickname} (${role})`;
  }
  if (nickname) {
    return nickname;
  }
  if (role) {
    return role;
  }

  return null;
}

function normalizeNativeCodexCollabAgentSummaryEntry(value: unknown): NativeCodexCollabAgentSummary | null {
  const normalizedRecord = normalizeNativeCodexRecord(value);
  if (!normalizedRecord) {
    return null;
  }

  return {
    nickname: normalizeNativeCodexNonEmptyString(
      normalizedRecord.agent_nickname ?? normalizedRecord.agentNickname,
    ),
    role: normalizeNativeCodexNonEmptyString(
      normalizedRecord.agent_role ?? normalizedRecord.agentRole,
    ),
    status: normalizeNativeCodexCollabAgentStatus(normalizedRecord.status),
    threadId: normalizeNativeCodexNonEmptyString(
      normalizedRecord.thread_id ?? normalizedRecord.threadId,
    ),
  };
}

function normalizeNativeCodexCollabStatusMap(
  value: unknown,
): Map<string, NativeCodexCollabAgentStatusSummary | null> {
  const statusMap = new Map<string, NativeCodexCollabAgentStatusSummary | null>();
  const normalizedRecord = normalizeNativeCodexRecord(value);
  if (!normalizedRecord) {
    return statusMap;
  }

  for (const [threadId, rawStatus] of Object.entries(normalizedRecord)) {
    const normalizedThreadId = normalizeNativeCodexNonEmptyString(threadId);
    if (!normalizedThreadId) {
      continue;
    }

    statusMap.set(normalizedThreadId, normalizeNativeCodexCollabAgentStatus(rawStatus));
  }

  return statusMap;
}

function normalizeNativeCodexCollabAgentSummaries(
  payload: NativeCodexEventPayload,
): NativeCodexCollabAgentSummary[] {
  const statusMap = normalizeNativeCodexCollabStatusMap(payload.statuses);
  const summaries: NativeCodexCollabAgentSummary[] = [];
  const seenThreadIds = new Set<string>();

  const rawAgentStatuses = payload.agent_statuses ?? payload.agentStatuses;
  if (Array.isArray(rawAgentStatuses)) {
    for (const rawAgentStatus of rawAgentStatuses) {
      const normalizedSummary = normalizeNativeCodexCollabAgentSummaryEntry(rawAgentStatus);
      if (!normalizedSummary?.threadId) {
        continue;
      }

      const mergedStatus =
        normalizedSummary.status ?? statusMap.get(normalizedSummary.threadId) ?? null;
      summaries.push({
        ...normalizedSummary,
        status: mergedStatus,
      });
      seenThreadIds.add(normalizedSummary.threadId);
    }
  }

  const remainingThreadIds = [...statusMap.keys()]
    .filter((threadId) => !seenThreadIds.has(threadId))
    .sort((left, right) => left.localeCompare(right));
  for (const threadId of remainingThreadIds) {
    summaries.push({
      nickname: null,
      role: null,
      status: statusMap.get(threadId) ?? null,
      threadId,
    });
  }

  return summaries;
}

function normalizeNativeCodexThreadIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeNativeCodexNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
}

function normalizeNativeCodexCollabReceiverAgentSummaries(
  payload: NativeCodexEventPayload,
): NativeCodexCollabAgentSummary[] {
  const summaries: NativeCodexCollabAgentSummary[] = [];
  const rawReceiverAgents = payload.receiver_agents ?? payload.receiverAgents;
  if (Array.isArray(rawReceiverAgents)) {
    for (const rawReceiverAgent of rawReceiverAgents) {
      const normalizedSummary = normalizeNativeCodexCollabAgentSummaryEntry(rawReceiverAgent);
      if (normalizedSummary?.threadId) {
        summaries.push(normalizedSummary);
      }
    }
  }

  const seenThreadIds = new Set(
    summaries
      .map((summary) => summary.threadId)
      .filter((threadId): threadId is string => threadId !== null),
  );
  const receiverThreadIds = normalizeNativeCodexThreadIdArray(
    payload.receiver_thread_ids ?? payload.receiverThreadIds,
  );
  for (const receiverThreadId of receiverThreadIds.sort((left, right) => left.localeCompare(right))) {
    if (seenThreadIds.has(receiverThreadId)) {
      continue;
    }

    summaries.push({
      nickname: null,
      role: null,
      status: null,
      threadId: receiverThreadId,
    });
  }

  return summaries;
}

function buildNativeCodexCollabSingleAgentEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
  options: {
    actionLabel: string;
    isRunning?: boolean;
    nickname: string | null;
    prompt?: string | null;
    reasoning?: string | null;
    role: string | null;
    status: NativeCodexCollabAgentStatusSummary | null;
    threadId: string | null;
    model?: string | null;
    treatMissingThreadAsFailure?: boolean;
  },
): NativeCodexSessionTranscriptEntry | null {
  const agentDisplay =
    formatNativeCodexCollabAgentDisplayName(options.nickname, options.role) ??
    options.threadId;
  const isFailure =
    options.status?.isError === true ||
    (options.treatMissingThreadAsFailure === true && !options.threadId);
  const statusWord = options.isRunning
    ? 'running'
    : isFailure
      ? 'failed'
      : 'completed';
  const contentLines = [
    agentDisplay
      ? `${options.actionLabel} ${statusWord}: ${agentDisplay}`
      : `${options.actionLabel} ${statusWord}`,
  ];
  if (options.threadId) {
    contentLines.push(`Thread: ${options.threadId}`);
  }
  if (options.model) {
    contentLines.push(`Model: ${options.model}`);
  }
  if (options.reasoning) {
    contentLines.push(`Reasoning: ${options.reasoning}`);
  }
  if (options.prompt) {
    contentLines.push(`Prompt: ${options.prompt}`);
  }
  if (options.status) {
    contentLines.push(`Agent status: ${options.status.label}`);
  }
  if (isFailure && options.status?.message) {
    contentLines.push(`Error: ${options.status.message}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexCollabSpawnEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Spawn agent',
    model: normalizeNativeCodexNonEmptyString(payload.model),
    nickname: normalizeNativeCodexNonEmptyString(
      payload.new_agent_nickname ?? payload.newAgentNickname,
    ),
    prompt: normalizeCodexPromptText(payload.prompt),
    reasoning: normalizeNativeCodexNonEmptyString(
      payload.reasoning_effort ?? payload.reasoningEffort,
    ),
    role: normalizeNativeCodexNonEmptyString(payload.new_agent_role ?? payload.newAgentRole),
    status: normalizeNativeCodexCollabAgentStatus(payload.status),
    threadId: normalizeNativeCodexNonEmptyString(payload.new_thread_id ?? payload.newThreadId),
    treatMissingThreadAsFailure: true,
  });
}

function createNativeCodexCollabSpawnBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Spawn agent',
    isRunning: true,
    model: normalizeNativeCodexNonEmptyString(payload.model),
    nickname: null,
    prompt: normalizeCodexPromptText(payload.prompt),
    reasoning: normalizeNativeCodexNonEmptyString(
      payload.reasoning_effort ?? payload.reasoningEffort,
    ),
    role: null,
    status: null,
    threadId: null,
  });
}

function createNativeCodexCollabInteractionEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Send input',
    nickname: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_nickname ?? payload.receiverAgentNickname,
    ),
    prompt: normalizeCodexPromptText(payload.prompt),
    role: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_role ?? payload.receiverAgentRole,
    ),
    status: normalizeNativeCodexCollabAgentStatus(payload.status),
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexCollabInteractionBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Send input',
    isRunning: true,
    nickname: null,
    prompt: normalizeCodexPromptText(payload.prompt),
    role: null,
    status: null,
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexCollabWaitEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const agentSummaries = normalizeNativeCodexCollabAgentSummaries(payload);
  const hasFailure = agentSummaries.some((agentSummary) => agentSummary.status?.isError === true);
  const contentLines = [
    `Wait ${hasFailure ? 'failed' : 'completed'} for ${agentSummaries.length} agent(s)`,
  ];
  for (const agentSummary of agentSummaries) {
    const agentDisplay =
      formatNativeCodexCollabAgentDisplayName(agentSummary.nickname, agentSummary.role) ??
      agentSummary.threadId ??
      'Unknown agent';
    const statusLabel = agentSummary.status?.label ?? 'unknown';
    const errorSuffix =
      agentSummary.status?.isError && agentSummary.status.message
        ? ` - ${agentSummary.status.message}`
        : '';
    if (agentSummary.threadId) {
      contentLines.push(
        `- ${agentDisplay} [${agentSummary.threadId}]: ${statusLabel}${errorSuffix}`,
      );
      continue;
    }

    contentLines.push(`- ${agentDisplay}: ${statusLabel}${errorSuffix}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexCollabWaitBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const agentSummaries = normalizeNativeCodexCollabReceiverAgentSummaries(payload);
  const contentLines = [
    `Wait running for ${agentSummaries.length} agent(s)`,
  ];
  for (const agentSummary of agentSummaries) {
    const agentDisplay =
      formatNativeCodexCollabAgentDisplayName(agentSummary.nickname, agentSummary.role) ??
      agentSummary.threadId ??
      'Unknown agent';
    if (agentSummary.threadId) {
      contentLines.push(`- ${agentDisplay} [${agentSummary.threadId}]`);
      continue;
    }

    contentLines.push(`- ${agentDisplay}`);
  }

  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines,
    payload,
  });
}

function createNativeCodexCollabResumeEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Resume agent',
    nickname: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_nickname ?? payload.receiverAgentNickname,
    ),
    role: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_role ?? payload.receiverAgentRole,
    ),
    status: normalizeNativeCodexCollabAgentStatus(payload.status),
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexCollabResumeBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Resume agent',
    isRunning: true,
    nickname: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_nickname ?? payload.receiverAgentNickname,
    ),
    role: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_role ?? payload.receiverAgentRole,
    ),
    status: null,
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexCollabCloseEndEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Close agent',
    nickname: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_nickname ?? payload.receiverAgentNickname,
    ),
    role: normalizeNativeCodexNonEmptyString(
      payload.receiver_agent_role ?? payload.receiverAgentRole,
    ),
    status: normalizeNativeCodexCollabAgentStatus(payload.status),
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexCollabCloseBeginEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexCollabSingleAgentEntry(payload, envelopeTimestamp, {
    actionLabel: 'Close agent',
    isRunning: true,
    nickname: null,
    role: null,
    status: null,
    threadId: normalizeNativeCodexNonEmptyString(
      payload.receiver_thread_id ?? payload.receiverThreadId,
    ),
  });
}

function createNativeCodexContextCompactionEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  return buildNativeCodexToolEntry(envelopeTimestamp, {
    contentLines: ['Context compacted'],
    payload,
  });
}

interface NativeCodexPatchChangeSummary {
  additions: number;
  deletions: number;
  path: string;
}

function countCodexContentLines(value: string): number {
  if (!value) {
    return 0;
  }

  return value.split(/\r?\n/u).filter((line) => line.length > 0).length;
}

function countCodexUnifiedDiffChanges(value: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of value.split(/\r?\n/u)) {
    if (!line || line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      continue;
    }

    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }

    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  return {
    additions,
    deletions,
  };
}

function parseNativeCodexPatchChangeSummaries(value: unknown): NativeCodexPatchChangeSummary[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([filePath, rawChange]) => {
      if (!rawChange || typeof rawChange !== 'object' || Array.isArray(rawChange)) {
        return null;
      }

      const change = rawChange as Record<string, unknown>;
      const normalizedPath = filePath.trim();
      if (!normalizedPath) {
        return null;
      }

      switch (change.type) {
        case 'add':
          return {
            additions: countCodexContentLines(
              typeof change.content === 'string' ? change.content : '',
            ),
            deletions: 0,
            path: normalizedPath,
          } satisfies NativeCodexPatchChangeSummary;
        case 'delete':
          return {
            additions: 0,
            deletions: countCodexContentLines(
              typeof change.content === 'string' ? change.content : '',
            ),
            path: normalizedPath,
          } satisfies NativeCodexPatchChangeSummary;
        case 'update': {
          const diffCounts = countCodexUnifiedDiffChanges(
            typeof change.unified_diff === 'string' ? change.unified_diff : '',
          );
          return {
            additions: diffCounts.additions,
            deletions: diffCounts.deletions,
            path: normalizedPath,
          } satisfies NativeCodexPatchChangeSummary;
        }
        default:
          return null;
      }
    })
    .filter((change): change is NativeCodexPatchChangeSummary => change !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function formatNativeCodexPatchChangeSummaries(
  changeSummaries: readonly NativeCodexPatchChangeSummary[],
): string[] {
  return changeSummaries.map(
    (changeSummary) =>
      `- ${changeSummary.path} (+${changeSummary.additions} -${changeSummary.deletions})`,
  );
}

function buildNativeCodexPatchEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
  options: {
    role: Extract<BirdCoderChatMessage['role'], 'reviewer' | 'tool'>;
    statusLabel: string;
    suffixLine?: string | null;
  },
): NativeCodexSessionTranscriptEntry | null {
  const changeSummaries = parseNativeCodexPatchChangeSummaries(payload.changes);
  if (changeSummaries.length === 0) {
    return null;
  }

  const contentLines = [
    `${options.statusLabel} for ${changeSummaries.length} file(s):`,
    ...formatNativeCodexPatchChangeSummaries(changeSummaries),
  ];
  if (options.suffixLine) {
    contentLines.push(options.suffixLine);
  }

  return {
    content: contentLines.join('\n'),
    createdAt: envelopeTimestamp,
    role: options.role,
    sourceId:
      normalizeNativeTurnId(payload.call_id) ??
      normalizeNativeTurnId(payload.callId),
    turnId:
      normalizeNativeTurnId(payload.turnId) ??
      normalizeNativeTurnId(payload.turn_id),
  };
}

function createNativeCodexPatchApprovalEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedReason = normalizeCodexMessageText(payload.reason);
  return buildNativeCodexPatchEntry(payload, envelopeTimestamp, {
    role: 'reviewer',
    statusLabel: 'Patch approval required',
    suffixLine: normalizedReason ? `Reason: ${normalizedReason}` : null,
  });
}

function createNativeCodexPatchResultEntry(
  payload: NativeCodexEventPayload,
  envelopeTimestamp: string,
): NativeCodexSessionTranscriptEntry | null {
  const normalizedStatus =
    typeof payload.status === 'string' && payload.status.trim().length > 0
      ? payload.status.trim().toLowerCase()
      : payload.success === true
        ? 'completed'
        : payload.success === false
          ? 'failed'
          : 'completed';
  const normalizedStdout = normalizeCodexMessageText(payload.stdout);
  const normalizedStderr = normalizeCodexMessageText(payload.stderr);

  return buildNativeCodexPatchEntry(payload, envelopeTimestamp, {
    role: 'tool',
    statusLabel: `Patch ${normalizedStatus}`,
    suffixLine:
      normalizedStdout
        ? `Output: ${normalizedStdout}`
        : normalizedStderr
          ? `Error: ${normalizedStderr}`
          : null,
  });
}

function areNativeCodexTranscriptEntriesEquivalent(
  left: NativeCodexSessionTranscriptEntry | null | undefined,
  right: NativeCodexSessionTranscriptEntry | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    left.role === right.role &&
    left.content === right.content &&
    (left.sourceId ?? '') === (right.sourceId ?? '') &&
    (left.turnId ?? '') === (right.turnId ?? '') &&
    JSON.stringify(left.commands ?? null) === JSON.stringify(right.commands ?? null)
  );
}

function upsertNativeCodexTranscriptEntry(
  entries: NativeCodexSessionTranscriptEntry[],
  entry: NativeCodexSessionTranscriptEntry,
): void {
  if (entry.sourceId) {
    const existingEntryIndex = entries.findIndex((candidate) =>
      candidate.role === entry.role &&
      (candidate.sourceId ?? '') === entry.sourceId &&
      (candidate.turnId ?? '') === (entry.turnId ?? ''),
    );
    if (existingEntryIndex >= 0) {
      entries[existingEntryIndex] = entry;
      return;
    }
  }

  entries.push(entry);
}

function trackNativeCodexTranscriptEntryTimestamp(
  fields: NativeCodexSessionResolvedFields,
  entry: NativeCodexSessionTranscriptEntry,
): void {
  const previousEntry = fields.previousTranscriptEntry;
  const isAdjacentDuplicate =
    areNativeCodexTranscriptEntriesEquivalent(previousEntry, entry) &&
    Math.abs(resolveIsoTimestamp(previousEntry.createdAt) - resolveIsoTimestamp(entry.createdAt)) <=
      5_000;

  if (!isAdjacentDuplicate) {
    fields.latestTranscriptMessageTimestamp = resolveMoreRecentIsoTimestamp(
      fields.latestTranscriptMessageTimestamp,
      entry.createdAt,
    );
  }

  fields.previousTranscriptEntry = entry;
}

function applyNativeCodexEnvelopeToResolvedFields(
  fields: NativeCodexSessionResolvedFields,
  envelope: NativeCodexSessionEnvelope,
  envelopeTimestamp: string,
  pathModule: NodePathModule | null,
): void {
  fields.latestTimestamp = resolveMoreRecentIsoTimestamp(
    fields.latestTimestamp,
    envelopeTimestamp,
  );

  switch (envelope.type) {
    case 'session_meta': {
      const payload =
        envelope.payload && typeof envelope.payload === 'object'
          ? envelope.payload as {
              cwd?: unknown;
              id?: unknown;
              timestamp?: unknown;
            }
          : null;
      if (!payload) {
        break;
      }

      if (typeof payload.id === 'string' && payload.id.trim()) {
        fields.nativeSessionId = payload.id.trim();
      }

      if (!fields.nativeWorkingDirectory) {
        fields.nativeWorkingDirectory = normalizeCodexWorkingDirectoryPath(payload.cwd);
      }

      const payloadTimestamp = normalizeOptionalIsoTimestamp(payload.timestamp);
      if (payloadTimestamp) {
        fields.createdAt = payloadTimestamp;
      } else if (resolveIsoTimestamp(envelopeTimestamp) > 0) {
        fields.createdAt ??= envelopeTimestamp;
      }

      if (!fields.fallbackTitle) {
        fields.fallbackTitle = normalizeCodexWorkingDirectoryTitle(payload.cwd, pathModule);
      }
      break;
    }
    case 'event_msg': {
      const payload =
        envelope.payload && typeof envelope.payload === 'object'
          ? envelope.payload as NativeCodexEventPayload
          : null;
      if (!payload || typeof payload.type !== 'string') {
        break;
      }

      switch (payload.type) {
        case 'task_started':
          fields.hasTaskStarted = true;
          break;
        case 'task_complete':
          fields.hasTaskComplete = true;
          break;
        case 'turn_aborted':
          fields.hasTurnAborted = true;
          break;
        case 'error':
          fields.hasError = true;
          break;
        case 'assistant_message':
        case 'agent_message': {
          const normalizedMessage = normalizeCodexMessageText(payload.message);
          if (normalizedMessage) {
            trackNativeCodexTranscriptEntryTimestamp(fields, {
              content: normalizedMessage,
              createdAt: envelopeTimestamp,
              role: 'assistant',
              turnId:
                normalizeNativeTurnId(payload.turnId) ??
                normalizeNativeTurnId(payload.turn_id),
            });
          }
          break;
        }
        case 'agent_reasoning': {
          const reasoningEntry = createNativeCodexReasoningEntry(payload, envelopeTimestamp);
          if (reasoningEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, reasoningEntry);
          }
          break;
        }
        case 'user_message': {
          const normalizedMessage = normalizeCodexMessageText(payload.message);
          if (normalizedMessage) {
            trackNativeCodexTranscriptEntryTimestamp(fields, {
              content: normalizedMessage,
              createdAt: envelopeTimestamp,
              role: 'user',
              turnId:
                normalizeNativeTurnId(payload.turnId) ??
                normalizeNativeTurnId(payload.turn_id),
            });
            fields.latestUserTimestamp = resolveMoreRecentIsoTimestamp(
              fields.latestUserTimestamp,
              envelopeTimestamp,
            );
          }

          const candidateTitle = normalizeCodexPromptText(payload.message);
          if (candidateTitle && !fields.resolvedTitle) {
            fields.resolvedTitle = candidateTitle;
          }
          break;
        }
        case 'exec_approval_request': {
          const commandApprovalEntry = createNativeCodexExecApprovalEntry(
            payload,
            envelopeTimestamp,
          );
          if (commandApprovalEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, commandApprovalEntry);
          }
          break;
        }
        case 'guardian_assessment': {
          const guardianAssessmentEntry = createNativeCodexGuardianAssessmentEntry(
            payload,
            envelopeTimestamp,
          );
          if (guardianAssessmentEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, guardianAssessmentEntry);
          }
          break;
        }
        case 'exec_command_end': {
          const commandEntry = createNativeCodexCommandEntry(payload, envelopeTimestamp);
          if (commandEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, commandEntry);
          }
          break;
        }
        case 'web_search_end': {
          const webSearchEntry = createNativeCodexWebSearchEntry(payload, envelopeTimestamp);
          if (webSearchEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, webSearchEntry);
          }
          break;
        }
        case 'dynamic_tool_call_request': {
          const dynamicToolRequestEntry = createNativeCodexDynamicToolRequestEntry(
            payload,
            envelopeTimestamp,
          );
          if (dynamicToolRequestEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, dynamicToolRequestEntry);
          }
          break;
        }
        case 'dynamic_tool_call_response': {
          const dynamicToolResponseEntry = createNativeCodexDynamicToolResponseEntry(
            payload,
            envelopeTimestamp,
          );
          if (dynamicToolResponseEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, dynamicToolResponseEntry);
          }
          break;
        }
        case 'mcp_tool_call_begin': {
          const mcpToolBeginEntry = createNativeCodexMcpToolBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (mcpToolBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, mcpToolBeginEntry);
          }
          break;
        }
        case 'mcp_tool_call_end': {
          const mcpToolEndEntry = createNativeCodexMcpToolEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (mcpToolEndEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, mcpToolEndEntry);
          }
          break;
        }
        case 'view_image_tool_call': {
          const viewImageEntry = createNativeCodexViewImageEntry(payload, envelopeTimestamp);
          if (viewImageEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, viewImageEntry);
          }
          break;
        }
        case 'image_generation_begin': {
          const imageGenerationBeginEntry = createNativeCodexImageGenerationBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (imageGenerationBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, imageGenerationBeginEntry);
          }
          break;
        }
        case 'image_generation_end': {
          const imageGenerationEndEntry = createNativeCodexImageGenerationEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (imageGenerationEndEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, imageGenerationEndEntry);
          }
          break;
        }
        case 'collab_agent_spawn_end': {
          const collabSpawnEntry = createNativeCodexCollabSpawnEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabSpawnEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabSpawnEntry);
          }
          break;
        }
        case 'collab_agent_spawn_begin': {
          const collabSpawnBeginEntry = createNativeCodexCollabSpawnBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabSpawnBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabSpawnBeginEntry);
          }
          break;
        }
        case 'collab_agent_interaction_end': {
          const collabInteractionEntry = createNativeCodexCollabInteractionEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabInteractionEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabInteractionEntry);
          }
          break;
        }
        case 'collab_agent_interaction_begin': {
          const collabInteractionBeginEntry = createNativeCodexCollabInteractionBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabInteractionBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabInteractionBeginEntry);
          }
          break;
        }
        case 'collab_waiting_end': {
          const collabWaitEntry = createNativeCodexCollabWaitEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabWaitEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabWaitEntry);
          }
          break;
        }
        case 'collab_waiting_begin': {
          const collabWaitBeginEntry = createNativeCodexCollabWaitBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabWaitBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabWaitBeginEntry);
          }
          break;
        }
        case 'collab_resume_end': {
          const collabResumeEntry = createNativeCodexCollabResumeEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabResumeEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabResumeEntry);
          }
          break;
        }
        case 'collab_resume_begin': {
          const collabResumeBeginEntry = createNativeCodexCollabResumeBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabResumeBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabResumeBeginEntry);
          }
          break;
        }
        case 'collab_close_end': {
          const collabCloseEntry = createNativeCodexCollabCloseEndEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabCloseEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabCloseEntry);
          }
          break;
        }
        case 'collab_close_begin': {
          const collabCloseBeginEntry = createNativeCodexCollabCloseBeginEntry(
            payload,
            envelopeTimestamp,
          );
          if (collabCloseBeginEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, collabCloseBeginEntry);
          }
          break;
        }
        case 'context_compacted': {
          const contextCompactionEntry = createNativeCodexContextCompactionEntry(
            payload,
            envelopeTimestamp,
          );
          if (contextCompactionEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, contextCompactionEntry);
          }
          break;
        }
        case 'entered_review_mode': {
          trackNativeCodexTranscriptEntryTimestamp(
            fields,
            createNativeCodexEnteredReviewModeEntry(payload, envelopeTimestamp),
          );
          break;
        }
        case 'exited_review_mode': {
          trackNativeCodexTranscriptEntryTimestamp(
            fields,
            createNativeCodexExitedReviewModeEntry(payload, envelopeTimestamp),
          );
          break;
        }
        case 'apply_patch_approval_request': {
          const patchApprovalEntry = createNativeCodexPatchApprovalEntry(
            payload,
            envelopeTimestamp,
          );
          if (patchApprovalEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, patchApprovalEntry);
          }
          break;
        }
        case 'patch_apply_end': {
          const patchResultEntry = createNativeCodexPatchResultEntry(
            payload,
            envelopeTimestamp,
          );
          if (patchResultEntry) {
            trackNativeCodexTranscriptEntryTimestamp(fields, patchResultEntry);
          }
          break;
        }
        default:
          break;
      }
      break;
    }
    case 'response_item': {
      const payload =
        envelope.payload && typeof envelope.payload === 'object'
          ? envelope.payload as NativeCodexMessagePayload
          : null;
      if (!payload || payload.type !== 'message') {
        break;
      }

      const normalizedMessage = extractCodexResponseItemText(payload.content);
      const normalizedRole = payload.role === 'assistant' || payload.role === 'user'
        ? payload.role
        : null;
      if (normalizedRole && normalizedMessage) {
        trackNativeCodexTranscriptEntryTimestamp(fields, {
          content: normalizedMessage,
          createdAt: envelopeTimestamp,
          role: normalizedRole,
          turnId:
            normalizeNativeTurnId(payload.turnId) ??
            normalizeNativeTurnId(payload.turn_id),
        });
      }
      if (normalizedRole === 'user' && normalizedMessage) {
        fields.latestUserTimestamp = resolveMoreRecentIsoTimestamp(
          fields.latestUserTimestamp,
          envelopeTimestamp,
        );
        if (!fields.resolvedTitle) {
          fields.resolvedTitle = truncateSessionTitle(
            normalizedMessage.replace(/\s+/gu, ' ').trim(),
          );
        }
      }
      break;
    }
    default:
      break;
  }
}

function buildNativeCodexSessionSummary(
  filePath: string,
  fields: NativeCodexSessionResolvedFields,
  fsModule: NodeFsModule,
  pathModule: NodePathModule,
  sessionIndexEntriesById?: ReadonlyMap<string, NativeCodexSessionIndexEntry>,
): StoredCodingSessionInventoryRecord {
  let fileModifiedAt = ZERO_TIMESTAMP;
  try {
    fileModifiedAt = toIsoTimestampFromMilliseconds(fsModule.statSync(filePath).mtimeMs);
  } catch {
    fileModifiedAt = ZERO_TIMESTAMP;
  }

  const summaryId = normalizeNativeCodexSessionId(fields.nativeSessionId, filePath, pathModule);
  const nativeSessionIndexEntry = sessionIndexEntriesById?.get(
    summaryId.slice(CODEX_NATIVE_SESSION_ID_PREFIX.length),
  );
  const resolvedCreatedAt = fields.createdAt ?? fields.latestTimestamp ?? fileModifiedAt;
  const summaryUpdatedAtCandidate = fields.latestTimestamp ?? fields.createdAt ?? fileModifiedAt;
  const resolvedUpdatedAt =
    resolveIsoTimestamp(nativeSessionIndexEntry?.updatedAt) >
      resolveIsoTimestamp(summaryUpdatedAtCandidate)
      ? nativeSessionIndexEntry?.updatedAt ?? summaryUpdatedAtCandidate
      : summaryUpdatedAtCandidate;
  const resolvedLastTurnAt =
    fields.latestUserTimestamp ?? fields.latestTimestamp ?? resolvedUpdatedAt;
  const status: BirdCoderCodingSessionStatus =
    fields.hasTaskComplete
      ? 'completed'
      : fields.hasTurnAborted || fields.hasError
        ? 'paused'
        : fields.hasTaskStarted
          ? 'active'
          : 'completed';

  return {
    id: summaryId,
    workspaceId: '',
    projectId: '',
    title:
      nativeSessionIndexEntry?.threadName ??
      fields.resolvedTitle ??
      fields.fallbackTitle ??
      'Codex Session',
    status,
    hostMode: normalizeHostMode('desktop'),
    engineId: 'codex',
    modelId: 'codex',
    kind: 'coding',
    nativeCwd: fields.nativeWorkingDirectory,
    createdAt: resolvedCreatedAt,
    updatedAt: resolvedUpdatedAt,
    lastTurnAt: resolvedLastTurnAt,
    sortTimestamp: resolveIsoTimestamp(resolvedUpdatedAt),
    transcriptUpdatedAt: fields.latestTranscriptMessageTimestamp,
  };
}

function resolveNativeCodexSessionIndexCacheSnapshot(
  summaryId: string,
  sessionIndexEntriesById?: ReadonlyMap<string, NativeCodexSessionIndexEntry>,
): {
  threadName: string | null;
  updatedAt: string | null;
} {
  const nativeSessionId = extractNativeCodexLookupId(summaryId);
  const nativeSessionIndexEntry = nativeSessionId
    ? sessionIndexEntriesById?.get(nativeSessionId)
    : null;

  return {
    threadName: nativeSessionIndexEntry?.threadName ?? null,
    updatedAt: nativeSessionIndexEntry?.updatedAt ?? null,
  };
}

function parseNativeCodexSessionSummaryFile(
  filePath: string,
  fsModule: NodeFsModule,
  pathModule: NodePathModule,
  sessionIndexEntriesById?: ReadonlyMap<string, NativeCodexSessionIndexEntry>,
): StoredCodingSessionInventoryRecord | null {
  let fileStats: NodeFsStatsLike;
  try {
    fileStats = fsModule.statSync(filePath);
  } catch {
    return null;
  }

  const cachedSummaryEntry = nativeCodexSessionSummaryCache.get(filePath);
  if (
    cachedSummaryEntry &&
    cachedSummaryEntry.fileModifiedAtMs === fileStats.mtimeMs &&
    cachedSummaryEntry.fileSize === fileStats.size
  ) {
    const sessionIndexSnapshot = resolveNativeCodexSessionIndexCacheSnapshot(
      cachedSummaryEntry.summary.id,
      sessionIndexEntriesById,
    );
    if (
      sessionIndexSnapshot.threadName === cachedSummaryEntry.sessionIndexThreadName &&
      sessionIndexSnapshot.updatedAt === cachedSummaryEntry.sessionIndexUpdatedAt
    ) {
      return structuredClone(cachedSummaryEntry.summary);
    }
  }

  if (!Number.isFinite(fileStats.size) || fileStats.size <= 0) {
    return null;
  }

  if (fileStats.size <= NATIVE_CODEX_SUMMARY_SMALL_FILE_THRESHOLD_BYTES) {
    const parsedSummary =
      parseNativeCodexSessionFile(
      filePath,
      fsModule,
      pathModule,
      sessionIndexEntriesById,
    )?.summary ?? null;
    if (parsedSummary) {
      const sessionIndexSnapshot = resolveNativeCodexSessionIndexCacheSnapshot(
        parsedSummary.id,
        sessionIndexEntriesById,
      );
      nativeCodexSessionSummaryCache.set(filePath, {
        fileModifiedAtMs: fileStats.mtimeMs,
        filePath,
        fileSize: fileStats.size,
        sessionIndexThreadName: sessionIndexSnapshot.threadName,
        sessionIndexUpdatedAt: sessionIndexSnapshot.updatedAt,
        summary: structuredClone(parsedSummary),
      });
    }
    return parsedSummary;
  }

  const resolvedFields: NativeCodexSessionResolvedFields = {
    createdAt: null,
    fallbackTitle: null,
    hasError: false,
    hasTaskComplete: false,
    hasTaskStarted: false,
    hasTurnAborted: false,
    latestTranscriptMessageTimestamp: null,
    latestTimestamp: null,
    latestUserTimestamp: null,
    previousTranscriptEntry: null,
    nativeSessionId: null,
    nativeWorkingDirectory: null,
    resolvedTitle: null,
  };

  for (const line of readNativeCodexSummaryHeadLines(filePath, fileStats.size, fsModule)) {
    let envelope: NativeCodexSessionEnvelope | null = null;
    try {
      envelope = JSON.parse(line) as NativeCodexSessionEnvelope;
    } catch {
      envelope = null;
    }

    if (!envelope) {
      continue;
    }

    const envelopeTimestamp =
      normalizeOptionalIsoTimestamp(envelope.timestamp) ?? ZERO_TIMESTAMP;
    applyNativeCodexEnvelopeToResolvedFields(
      resolvedFields,
      envelope,
      envelopeTimestamp,
      pathModule,
    );
  }

  for (const line of readNativeCodexSummaryTailLines(filePath, fileStats.size, fsModule)) {
    let envelope: NativeCodexSessionEnvelope | null = null;
    try {
      envelope = JSON.parse(line) as NativeCodexSessionEnvelope;
    } catch {
      envelope = null;
    }

    if (!envelope) {
      continue;
    }

    const envelopeTimestamp =
      normalizeOptionalIsoTimestamp(envelope.timestamp) ?? ZERO_TIMESTAMP;
    applyNativeCodexEnvelopeToResolvedFields(
      resolvedFields,
      envelope,
      envelopeTimestamp,
      pathModule,
    );
  }

  const summary = buildNativeCodexSessionSummary(
    filePath,
    resolvedFields,
    fsModule,
    pathModule,
    sessionIndexEntriesById,
  );
  const sessionIndexSnapshot = resolveNativeCodexSessionIndexCacheSnapshot(
    summary.id,
    sessionIndexEntriesById,
  );
  nativeCodexSessionSummaryCache.set(filePath, {
    fileModifiedAtMs: fileStats.mtimeMs,
    filePath,
    fileSize: fileStats.size,
    sessionIndexThreadName: sessionIndexSnapshot.threadName,
    sessionIndexUpdatedAt: sessionIndexSnapshot.updatedAt,
    summary: structuredClone(summary),
  });
  return summary;
}

function toTranscriptMessage(
  codingSessionId: string,
  entry: NativeCodexSessionTranscriptEntry,
  index: number,
): BirdCoderChatMessage {
  return {
    id: `${codingSessionId}:native-message:${index + 1}`,
    codingSessionId,
    role: entry.role,
    content: entry.content,
    commands: entry.commands,
    createdAt: entry.createdAt,
    turnId: entry.turnId,
    timestamp: resolveIsoTimestamp(entry.createdAt),
  };
}

function dedupeTranscriptEntries(
  entries: readonly NativeCodexSessionTranscriptEntry[],
): NativeCodexSessionTranscriptEntry[] {
  const dedupedEntries: NativeCodexSessionTranscriptEntry[] = [];

  for (const entry of entries) {
    const previousEntry = dedupedEntries[dedupedEntries.length - 1];
    const isAdjacentDuplicate =
      areNativeCodexTranscriptEntriesEquivalent(previousEntry, entry) &&
      Math.abs(resolveIsoTimestamp(previousEntry.createdAt) - resolveIsoTimestamp(entry.createdAt)) <=
        5_000;
    if (isAdjacentDuplicate) {
      continue;
    }

    dedupedEntries.push(entry);
  }

  return dedupedEntries;
}

function parseNativeCodexSessionFile(
  filePath: string,
  fsModule: NodeFsModule,
  pathModule: NodePathModule,
  sessionIndexEntriesById?: ReadonlyMap<string, NativeCodexSessionIndexEntry>,
): NativeCodexSessionRecord | null {
  let fileContent = '';
  try {
    fileContent = fsModule.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const normalizedContent = fileContent.trim();
  if (!normalizedContent) {
    return null;
  }

  let latestTimestamp: string | null = null;
  let latestUserTimestamp: string | null = null;
  let createdAt: string | null = null;
  let nativeSessionId: string | null = null;
  let nativeWorkingDirectory: string | null = null;
  let fallbackTitle: string | null = null;
  let resolvedTitle: string | null = null;
  let hasTaskStarted = false;
  let hasTaskComplete = false;
  let hasTurnAborted = false;
  let hasError = false;
  const transcriptEntries: NativeCodexSessionTranscriptEntry[] = [];

  for (const line of normalizedContent.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    let envelope: NativeCodexSessionEnvelope;
    try {
      envelope = JSON.parse(trimmedLine) as NativeCodexSessionEnvelope;
    } catch {
      continue;
    }

    const envelopeTimestamp = normalizeOptionalIsoTimestamp(envelope.timestamp) ?? ZERO_TIMESTAMP;
    if (resolveIsoTimestamp(envelopeTimestamp) > resolveIsoTimestamp(latestTimestamp)) {
      latestTimestamp = envelopeTimestamp;
    }

    switch (envelope.type) {
      case 'session_meta': {
        const payload =
          envelope.payload && typeof envelope.payload === 'object'
            ? envelope.payload as {
                cwd?: unknown;
                id?: unknown;
                timestamp?: unknown;
              }
            : null;
        if (!payload) {
          break;
        }

        if (typeof payload.id === 'string' && payload.id.trim()) {
          nativeSessionId = payload.id.trim();
        }

        if (!nativeWorkingDirectory) {
          nativeWorkingDirectory = normalizeCodexWorkingDirectoryPath(payload.cwd);
        }

        const payloadTimestamp = normalizeOptionalIsoTimestamp(payload.timestamp);
        if (payloadTimestamp) {
          createdAt = payloadTimestamp;
        } else if (envelopeTimestamp) {
          createdAt = envelopeTimestamp;
        }

        if (!fallbackTitle) {
          fallbackTitle = normalizeCodexWorkingDirectoryTitle(payload.cwd, pathModule);
        }
        break;
      }
      case 'event_msg': {
        const payload =
          envelope.payload && typeof envelope.payload === 'object'
            ? envelope.payload as NativeCodexEventPayload
            : null;
        if (!payload || typeof payload.type !== 'string') {
          break;
        }

        switch (payload.type) {
          case 'task_started':
            hasTaskStarted = true;
            break;
          case 'task_complete':
            hasTaskComplete = true;
            break;
          case 'turn_aborted':
            hasTurnAborted = true;
            break;
          case 'error':
            hasError = true;
            break;
          case 'user_message': {
            const normalizedMessage = normalizeCodexMessageText(payload.message);
            if (normalizedMessage) {
              transcriptEntries.push({
                content: normalizedMessage,
                createdAt: envelopeTimestamp,
                role: 'user',
                turnId:
                  normalizeNativeTurnId(payload.turnId) ??
                  normalizeNativeTurnId(payload.turn_id),
              });
            }

            const candidateTitle = normalizeCodexPromptText(payload.message);
            if (candidateTitle && !resolvedTitle) {
              resolvedTitle = candidateTitle;
            }
            if (candidateTitle && envelopeTimestamp) {
              latestUserTimestamp = envelopeTimestamp;
            }
            break;
          }
          case 'assistant_message':
          case 'agent_message': {
            const normalizedMessage = normalizeCodexMessageText(payload.message);
            if (normalizedMessage) {
              transcriptEntries.push({
                content: normalizedMessage,
                createdAt: envelopeTimestamp,
                role: 'assistant',
                turnId:
                  normalizeNativeTurnId(payload.turnId) ??
                  normalizeNativeTurnId(payload.turn_id),
              });
            }
            break;
          }
          case 'agent_reasoning': {
            const reasoningEntry = createNativeCodexReasoningEntry(payload, envelopeTimestamp);
            if (reasoningEntry) {
              transcriptEntries.push(reasoningEntry);
            }
            break;
          }
          case 'exec_approval_request': {
            const commandApprovalEntry = createNativeCodexExecApprovalEntry(
              payload,
              envelopeTimestamp,
            );
            if (commandApprovalEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, commandApprovalEntry);
            }
            break;
          }
          case 'guardian_assessment': {
            const guardianAssessmentEntry = createNativeCodexGuardianAssessmentEntry(
              payload,
              envelopeTimestamp,
            );
            if (guardianAssessmentEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, guardianAssessmentEntry);
            }
            break;
          }
          case 'exec_command_end': {
            const commandEntry = createNativeCodexCommandEntry(payload, envelopeTimestamp);
            if (commandEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, commandEntry);
            }
            break;
          }
          case 'web_search_end': {
            const webSearchEntry = createNativeCodexWebSearchEntry(payload, envelopeTimestamp);
            if (webSearchEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, webSearchEntry);
            }
            break;
          }
          case 'dynamic_tool_call_request': {
            const dynamicToolRequestEntry = createNativeCodexDynamicToolRequestEntry(
              payload,
              envelopeTimestamp,
            );
            if (dynamicToolRequestEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, dynamicToolRequestEntry);
            }
            break;
          }
          case 'dynamic_tool_call_response': {
            const dynamicToolResponseEntry = createNativeCodexDynamicToolResponseEntry(
              payload,
              envelopeTimestamp,
            );
            if (dynamicToolResponseEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, dynamicToolResponseEntry);
            }
            break;
          }
          case 'mcp_tool_call_begin': {
            const mcpToolBeginEntry = createNativeCodexMcpToolBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (mcpToolBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, mcpToolBeginEntry);
            }
            break;
          }
          case 'mcp_tool_call_end': {
            const mcpToolEndEntry = createNativeCodexMcpToolEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (mcpToolEndEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, mcpToolEndEntry);
            }
            break;
          }
          case 'view_image_tool_call': {
            const viewImageEntry = createNativeCodexViewImageEntry(payload, envelopeTimestamp);
            if (viewImageEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, viewImageEntry);
            }
            break;
          }
          case 'image_generation_begin': {
            const imageGenerationBeginEntry = createNativeCodexImageGenerationBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (imageGenerationBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, imageGenerationBeginEntry);
            }
            break;
          }
          case 'image_generation_end': {
            const imageGenerationEndEntry = createNativeCodexImageGenerationEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (imageGenerationEndEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, imageGenerationEndEntry);
            }
            break;
          }
          case 'collab_agent_spawn_end': {
            const collabSpawnEntry = createNativeCodexCollabSpawnEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabSpawnEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabSpawnEntry);
            }
            break;
          }
          case 'collab_agent_spawn_begin': {
            const collabSpawnBeginEntry = createNativeCodexCollabSpawnBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabSpawnBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabSpawnBeginEntry);
            }
            break;
          }
          case 'collab_agent_interaction_end': {
            const collabInteractionEntry = createNativeCodexCollabInteractionEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabInteractionEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabInteractionEntry);
            }
            break;
          }
          case 'collab_agent_interaction_begin': {
            const collabInteractionBeginEntry = createNativeCodexCollabInteractionBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabInteractionBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabInteractionBeginEntry);
            }
            break;
          }
          case 'collab_waiting_end': {
            const collabWaitEntry = createNativeCodexCollabWaitEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabWaitEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabWaitEntry);
            }
            break;
          }
          case 'collab_waiting_begin': {
            const collabWaitBeginEntry = createNativeCodexCollabWaitBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabWaitBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabWaitBeginEntry);
            }
            break;
          }
          case 'collab_resume_end': {
            const collabResumeEntry = createNativeCodexCollabResumeEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabResumeEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabResumeEntry);
            }
            break;
          }
          case 'collab_resume_begin': {
            const collabResumeBeginEntry = createNativeCodexCollabResumeBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabResumeBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabResumeBeginEntry);
            }
            break;
          }
          case 'collab_close_end': {
            const collabCloseEntry = createNativeCodexCollabCloseEndEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabCloseEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabCloseEntry);
            }
            break;
          }
          case 'collab_close_begin': {
            const collabCloseBeginEntry = createNativeCodexCollabCloseBeginEntry(
              payload,
              envelopeTimestamp,
            );
            if (collabCloseBeginEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, collabCloseBeginEntry);
            }
            break;
          }
          case 'context_compacted': {
            const contextCompactionEntry = createNativeCodexContextCompactionEntry(
              payload,
              envelopeTimestamp,
            );
            if (contextCompactionEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, contextCompactionEntry);
            }
            break;
          }
          case 'entered_review_mode': {
            transcriptEntries.push(
              createNativeCodexEnteredReviewModeEntry(payload, envelopeTimestamp),
            );
            break;
          }
          case 'exited_review_mode': {
            transcriptEntries.push(
              createNativeCodexExitedReviewModeEntry(payload, envelopeTimestamp),
            );
            break;
          }
          case 'apply_patch_approval_request': {
            const patchApprovalEntry = createNativeCodexPatchApprovalEntry(
              payload,
              envelopeTimestamp,
            );
            if (patchApprovalEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, patchApprovalEntry);
            }
            break;
          }
          case 'patch_apply_end': {
            const patchResultEntry = createNativeCodexPatchResultEntry(
              payload,
              envelopeTimestamp,
            );
            if (patchResultEntry) {
              upsertNativeCodexTranscriptEntry(transcriptEntries, patchResultEntry);
            }
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'response_item': {
        const payload =
          envelope.payload && typeof envelope.payload === 'object'
            ? envelope.payload as NativeCodexMessagePayload
            : null;
        if (!payload || payload.type !== 'message') {
          break;
        }

        const normalizedMessage = extractCodexResponseItemText(payload.content);
        const normalizedRole = payload.role === 'assistant' || payload.role === 'user'
          ? payload.role
          : null;
        if (normalizedMessage && normalizedRole) {
          transcriptEntries.push({
            content: normalizedMessage,
            createdAt: envelopeTimestamp,
            role: normalizedRole,
            turnId:
              normalizeNativeTurnId(payload.turnId) ??
              normalizeNativeTurnId(payload.turn_id),
          });
        }

        if (normalizedRole === 'user' && !resolvedTitle) {
          const candidateTitle = extractCodexResponseItemText(payload.content);
          if (candidateTitle) {
            resolvedTitle = truncateSessionTitle(candidateTitle.replace(/\s+/gu, ' ').trim());
            latestUserTimestamp = envelopeTimestamp;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  const dedupedTranscriptEntries = dedupeTranscriptEntries(
    transcriptEntries
      .filter((entry) => entry.content.trim().length > 0)
      .sort(
        (left, right) =>
          resolveIsoTimestamp(left.createdAt) - resolveIsoTimestamp(right.createdAt) ||
          left.role.localeCompare(right.role),
      ),
  );

  const summary = buildNativeCodexSessionSummary(
    filePath,
    {
      createdAt,
      fallbackTitle,
      hasError,
      hasTaskComplete,
      hasTaskStarted,
      hasTurnAborted,
      latestTranscriptMessageTimestamp:
        dedupedTranscriptEntries[dedupedTranscriptEntries.length - 1]?.createdAt ?? null,
      latestTimestamp,
      latestUserTimestamp,
      previousTranscriptEntry: null,
      nativeSessionId,
      nativeWorkingDirectory,
      resolvedTitle,
    },
    fsModule,
    pathModule,
    sessionIndexEntriesById,
  );

  return {
    filePath,
    summary,
    messages: dedupedTranscriptEntries.map((entry, index) =>
      toTranscriptMessage(summary.id, entry, index),
    ),
  };
}

function listNativeCodexSessionFilePaths(limitHint?: number): string[] {
  const fsModule = getFsModule();
  const pathModule = getPathModule();
  const codexHomeDirectory = resolveCodexHomeDirectory();
  if (!fsModule || !pathModule || !codexHomeDirectory) {
    return [];
  }

  const sessionsDirectory = pathModule.join(codexHomeDirectory, 'sessions');
  if (!fsModule.existsSync(sessionsDirectory)) {
    return [];
  }

  const sessionFiles = listCodexSessionFiles(sessionsDirectory, fsModule, pathModule);
  if (typeof limitHint === 'number') {
    return sessionFiles.slice(0, Math.max(limitHint, 0));
  }

  return sessionFiles;
}

function listNativeCodexSessionCandidateFilePaths(
  codingSessionId: string,
): string[] {
  const pathModule = getPathModule();
  const nativeSessionId = extractNativeCodexLookupId(codingSessionId.trim());
  if (!pathModule || !nativeSessionId) {
    return [];
  }

  return listNativeCodexSessionFilePaths(undefined).filter((filePath) =>
    matchesNativeCodexSessionFileName(filePath, nativeSessionId, pathModule),
  );
}

export async function listNativeCodexSessions(
  limitHint?: number,
): Promise<StoredCodingSessionInventoryRecord[]> {
  const fsModule = getFsModule();
  const pathModule = getPathModule();
  const codexHomeDirectory = resolveCodexHomeDirectory();
  if (!fsModule || !pathModule) {
    return [];
  }

  const sessionIndexEntriesById =
    codexHomeDirectory
      ? readNativeCodexSessionIndexEntries(codexHomeDirectory, fsModule, pathModule)
      : new Map<string, NativeCodexSessionIndexEntry>();

  const summaries = listNativeCodexSessionFilePaths(undefined)
    .map((filePath) =>
      parseNativeCodexSessionSummaryFile(
        filePath,
        fsModule,
        pathModule,
        sessionIndexEntriesById,
      ))
    .filter((record): record is StoredCodingSessionInventoryRecord => record !== null)
    .sort((left, right) => resolveIsoTimestamp(right.updatedAt) - resolveIsoTimestamp(left.updatedAt));

  if (typeof limitHint === 'number') {
    return summaries.slice(0, Math.max(limitHint, 0));
  }

  return summaries;
}

export async function readNativeCodexSessionRecord(
  codingSessionId: string,
): Promise<NativeCodexSessionRecord | null> {
  const normalizedCodingSessionId = codingSessionId.trim();
  if (!normalizedCodingSessionId || !extractNativeCodexLookupId(normalizedCodingSessionId)) {
    return null;
  }

  const fsModule = getFsModule();
  const pathModule = getPathModule();
  const codexHomeDirectory = resolveCodexHomeDirectory();
  if (!fsModule || !pathModule) {
    return null;
  }

  const sessionIndexEntriesById =
    codexHomeDirectory
      ? readNativeCodexSessionIndexEntries(codexHomeDirectory, fsModule, pathModule)
      : new Map<string, NativeCodexSessionIndexEntry>();

  const candidateFilePaths = listNativeCodexSessionCandidateFilePaths(normalizedCodingSessionId);
  if (candidateFilePaths.length === 0) {
    return null;
  }

  for (const filePath of candidateFilePaths) {
    const record = parseNativeCodexSessionFile(
      filePath,
      fsModule,
      pathModule,
      sessionIndexEntriesById,
    );
    if (record?.summary.id === normalizedCodingSessionId) {
      return record;
    }
  }

  return null;
}
