import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compareBirdCoderCodingSessionEventSequence,
  isBirdCoderCodeEngineSettledStatus,
  isBirdCoderCodeEngineUserQuestionToolName,
  parseBirdCoderApiJson,
  resolveBirdCoderCodeEngineApprovalId,
  resolveBirdCoderCodeEngineCheckpointId,
  resolveBirdCoderCodeEngineToolCallId,
  resolveBirdCoderCodeEngineUserQuestionId,
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-types';
import type { ICoreReadService, ICoreWriteService } from '@sdkwork/birdcoder-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

export interface BirdCoderCodingSessionProjection {
  artifacts: BirdCoderCodingSessionArtifact[];
  checkpoints: BirdCoderCodingSessionCheckpoint[];
  events: BirdCoderCodingSessionEvent[];
  session: BirdCoderCodingSessionSummary | null;
}

export interface BirdCoderCodingSessionProjectionState extends BirdCoderCodingSessionProjection {
  isLoading: boolean;
}

export interface BirdCoderCodingSessionPendingApproval {
  approvalId: string;
  artifactIds: string[];
  checkpointId: string;
  codingSessionId: string;
  operationId?: string;
  reason?: string;
  runtimeId?: string;
  turnId?: string;
}

export interface BirdCoderCodingSessionApprovalState {
  approvals: BirdCoderCodingSessionPendingApproval[];
  isLoading: boolean;
}

export interface BirdCoderCodingSessionPendingUserQuestionOption {
  description?: string;
  id?: string;
  label: string;
  value?: string;
}

export interface BirdCoderCodingSessionPendingUserQuestionPrompt {
  header?: string;
  options?: BirdCoderCodingSessionPendingUserQuestionOption[];
  question: string;
}

export interface BirdCoderCodingSessionPendingUserQuestion {
  checkpointId?: string;
  codingSessionId: string;
  prompt: string;
  questionId: string;
  questions: BirdCoderCodingSessionPendingUserQuestionPrompt[];
  runtimeId?: string;
  toolCallId?: string;
  turnId?: string;
}

export interface BirdCoderCodingSessionUserQuestionState {
  isLoading: boolean;
  questions: BirdCoderCodingSessionPendingUserQuestion[];
}

export interface BirdCoderCodingSessionPendingInteractions {
  approvals: BirdCoderCodingSessionPendingApproval[];
  questions: BirdCoderCodingSessionPendingUserQuestion[];
}

export interface BirdCoderCodingSessionPendingInteractionState
  extends BirdCoderCodingSessionPendingInteractions {
  isLoading: boolean;
}

const EMPTY_PROJECTION: BirdCoderCodingSessionProjection = {
  artifacts: [],
  checkpoints: [],
  events: [],
  session: null,
};

const INITIAL_STATE: BirdCoderCodingSessionProjectionState = {
  ...EMPTY_PROJECTION,
  isLoading: false,
};

const EMPTY_APPROVALS: BirdCoderCodingSessionPendingApproval[] = [];
const INITIAL_APPROVAL_STATE: BirdCoderCodingSessionApprovalState = {
  approvals: EMPTY_APPROVALS,
  isLoading: false,
};
const EMPTY_USER_QUESTIONS: BirdCoderCodingSessionPendingUserQuestion[] = [];
const INITIAL_USER_QUESTION_STATE: BirdCoderCodingSessionUserQuestionState = {
  questions: EMPTY_USER_QUESTIONS,
  isLoading: false,
};
const EMPTY_PENDING_INTERACTIONS: BirdCoderCodingSessionPendingInteractions = {
  approvals: EMPTY_APPROVALS,
  questions: EMPTY_USER_QUESTIONS,
};
const INITIAL_PENDING_INTERACTION_STATE: BirdCoderCodingSessionPendingInteractionState = {
  ...EMPTY_PENDING_INTERACTIONS,
  isLoading: false,
};

function compareOptionalTimestamp(
  left: string | undefined,
  right: string | undefined,
): number {
  const leftTimestamp = Date.parse(left ?? '');
  const rightTimestamp = Date.parse(right ?? '');
  const hasLeftTimestamp = Number.isFinite(leftTimestamp);
  const hasRightTimestamp = Number.isFinite(rightTimestamp);

  if (hasLeftTimestamp && hasRightTimestamp && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }
  if (hasLeftTimestamp !== hasRightTimestamp) {
    return hasLeftTimestamp ? 1 : -1;
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}

function compareCodingSessionEventChronology(
  left: BirdCoderCodingSessionEvent,
  right: BirdCoderCodingSessionEvent,
): number {
  const sequenceComparison = compareBirdCoderCodingSessionEventSequence(left, right);
  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const createdAtComparison = compareOptionalTimestamp(left.createdAt, right.createdAt);
  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareCodingSessionCheckpointChronology(
  left: BirdCoderCodingSessionCheckpoint,
  right: BirdCoderCodingSessionCheckpoint,
): number {
  const createdAtComparison = compareOptionalTimestamp(left.createdAt, right.createdAt);
  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function normalizePendingApprovals(
  approvals: BirdCoderCodingSessionPendingApproval[],
): BirdCoderCodingSessionPendingApproval[] {
  if (approvals.length === 0) {
    return EMPTY_APPROVALS;
  }

  const pendingByApprovalId = new Map<string, BirdCoderCodingSessionPendingApproval>();
  for (const approval of approvals) {
    const approvalId = approval.approvalId.trim();
    if (!approvalId) {
      continue;
    }

    pendingByApprovalId.set(
      approvalId,
      approvalId === approval.approvalId ? approval : { ...approval, approvalId },
    );
  }

  const normalizedApprovals = [...pendingByApprovalId.values()];
  return normalizedApprovals.length > 0 ? normalizedApprovals : EMPTY_APPROVALS;
}

function normalizePendingUserQuestions(
  questions: BirdCoderCodingSessionPendingUserQuestion[],
): BirdCoderCodingSessionPendingUserQuestion[] {
  if (questions.length === 0) {
    return EMPTY_USER_QUESTIONS;
  }

  const pendingByQuestionId = new Map<string, BirdCoderCodingSessionPendingUserQuestion>();
  for (const question of questions) {
    const questionId = question.questionId.trim();
    if (!questionId) {
      continue;
    }

    pendingByQuestionId.set(
      questionId,
      questionId === question.questionId ? question : { ...question, questionId },
    );
  }

  const normalizedQuestions = [...pendingByQuestionId.values()];
  return normalizedQuestions.length > 0 ? normalizedQuestions : EMPTY_USER_QUESTIONS;
}

function normalizePendingInteractions(
  pendingInteractions: BirdCoderCodingSessionPendingInteractions,
): BirdCoderCodingSessionPendingInteractions {
  const approvals = normalizePendingApprovals(pendingInteractions.approvals);
  const questions = normalizePendingUserQuestions(pendingInteractions.questions);
  return approvals.length === 0 && questions.length === 0
    ? EMPTY_PENDING_INTERACTIONS
    : {
        approvals,
        questions,
      };
}

function readStringRecordField(record: Record<string, unknown> | undefined, fieldName: string) {
  const value = record?.[fieldName];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readArtifactOperationId(artifact: BirdCoderCodingSessionArtifact) {
  if (!artifact.metadata || typeof artifact.metadata !== 'object') {
    return undefined;
  }

  return readStringRecordField(artifact.metadata as Record<string, unknown>, 'operationId');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    const parsedValue = parseBirdCoderApiJson(value) as unknown;
    return isRecord(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function readEventToolArguments(event: BirdCoderCodingSessionEvent): Record<string, unknown> | null {
  return parseRecord(
    event.payload?.toolArguments ??
      event.payload?.arguments ??
      event.payload?.input,
  );
}

function readUserQuestionOptions(
  value: unknown,
): BirdCoderCodingSessionPendingUserQuestionOption[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const options = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const label =
      readStringRecordField(entry, 'label') ??
      readStringRecordField(entry, 'title') ??
      readStringRecordField(entry, 'value');
    if (!label) {
      return [];
    }

    return [
      {
        label,
        ...(readStringRecordField(entry, 'description')
          ? { description: readStringRecordField(entry, 'description') }
          : {}),
        ...(readStringRecordField(entry, 'id') ? { id: readStringRecordField(entry, 'id') } : {}),
        ...(readStringRecordField(entry, 'value')
          ? { value: readStringRecordField(entry, 'value') }
          : {}),
      } satisfies BirdCoderCodingSessionPendingUserQuestionOption,
    ];
  });

  return options.length > 0 ? options : undefined;
}

function readUserQuestionPrompt(
  value: unknown,
): BirdCoderCodingSessionPendingUserQuestionPrompt | null {
  if (!isRecord(value)) {
    return null;
  }

  const question =
    readStringRecordField(value, 'question') ??
    readStringRecordField(value, 'prompt') ??
    readStringRecordField(value, 'title') ??
    readStringRecordField(value, 'header');
  if (!question) {
    return null;
  }

  return {
    ...(readStringRecordField(value, 'header')
      ? { header: readStringRecordField(value, 'header') }
      : {}),
    question,
    ...(readUserQuestionOptions(value.options)
      ? { options: readUserQuestionOptions(value.options) }
      : {}),
  };
}

function readUserQuestionPrompts(
  args: Record<string, unknown> | null,
): BirdCoderCodingSessionPendingUserQuestionPrompt[] {
  const questions = Array.isArray(args?.questions)
    ? args.questions.flatMap((entry) => {
        const question = readUserQuestionPrompt(entry);
        return question ? [question] : [];
      })
    : [];
  if (questions.length > 0) {
    return questions;
  }

  const directQuestion = readUserQuestionPrompt(args);
  return directQuestion ? [directQuestion] : [];
}

function isUserQuestionEvent(event: BirdCoderCodingSessionEvent): boolean {
  if (event.kind !== 'tool.call.requested' && event.kind !== 'tool.call.progress') {
    return false;
  }

  const toolName =
    readStringRecordField(event.payload, 'toolName') ??
    readStringRecordField(event.payload, 'name');
  return isBirdCoderCodeEngineUserQuestionToolName(toolName);
}

function readUserQuestionEventIdentity(event: BirdCoderCodingSessionEvent): {
  questionId?: string;
  toolCallId?: string;
} {
  const args = readEventToolArguments(event);
  const toolCallId = resolveBirdCoderCodeEngineToolCallId({
    payload: event.payload,
    toolArguments: args,
  });
  const questionId = resolveBirdCoderCodeEngineUserQuestionId({
    payload: event.payload,
    toolArguments: args,
    toolCallId,
  });

  return {
    questionId,
    toolCallId,
  };
}

function hasUserQuestionAnswer(event: BirdCoderCodingSessionEvent): boolean {
  const args = readEventToolArguments(event);
  return (
    !!readStringRecordField(event.payload, 'answer') ||
    !!readStringRecordField(args ?? undefined, 'answer')
  );
}

function hasSettledUserQuestionStatus(event: BirdCoderCodingSessionEvent): boolean {
  const args = readEventToolArguments(event);
  return [
    event.payload?.runtimeStatus,
    event.payload?.status,
    event.payload?.state,
    event.payload?.phase,
    args?.runtimeStatus,
    args?.status,
    args?.state,
    args?.phase,
  ].some(isBirdCoderCodeEngineSettledStatus);
}

function isUserQuestionLifecycleEvent(event: BirdCoderCodingSessionEvent): boolean {
  if (
    event.kind !== 'operation.updated' &&
    event.kind !== 'tool.call.completed' &&
    event.kind !== 'tool.call.progress'
  ) {
    return false;
  }

  const args = readEventToolArguments(event);
  const toolName =
    readStringRecordField(event.payload, 'toolName') ??
    readStringRecordField(event.payload, 'name') ??
    readStringRecordField(args ?? undefined, 'toolName') ??
    readStringRecordField(args ?? undefined, 'name');
  if (isBirdCoderCodeEngineUserQuestionToolName(toolName)) {
    return true;
  }

  return (
    !!resolveBirdCoderCodeEngineUserQuestionId({
      payload: event.payload,
      toolArguments: args,
    })
  );
}

function deriveSettledUserQuestionKeys(
  events: readonly BirdCoderCodingSessionEvent[],
): Set<string> {
  const settledKeys = new Set<string>();

  for (const event of events) {
    if (!isUserQuestionLifecycleEvent(event)) {
      continue;
    }
    if (!hasUserQuestionAnswer(event) && !hasSettledUserQuestionStatus(event)) {
      continue;
    }

    const args = readEventToolArguments(event);
    const toolCallId = resolveBirdCoderCodeEngineToolCallId({
      payload: event.payload,
      toolArguments: args,
    });
    const questionId = resolveBirdCoderCodeEngineUserQuestionId({
      payload: event.payload,
      toolArguments: args,
      toolCallId,
    });

    if (questionId) {
      settledKeys.add(`question:${questionId}`);
    }
    if (toolCallId) {
      settledKeys.add(`tool:${toolCallId}`);
    }
  }

  return settledKeys;
}

function hasSettledApprovalLifecycle(event: BirdCoderCodingSessionEvent): boolean {
  const args = readEventToolArguments(event);
  const hasSettledDecision = [
    event.payload?.approvalDecision,
    event.payload?.decision,
    args?.approvalDecision,
    args?.decision,
  ].some(isBirdCoderCodeEngineSettledStatus);
  if (hasSettledDecision) {
    return true;
  }

  return [
    event.payload?.runtimeStatus,
    event.payload?.operationStatus,
    event.payload?.status,
    args?.runtimeStatus,
    args?.status,
  ].some(isBirdCoderCodeEngineSettledStatus);
}

function deriveSettledApprovalKeys(
  events: readonly BirdCoderCodingSessionEvent[],
): Set<string> {
  const settledKeys = new Set<string>();

  for (const event of events) {
    if (
      event.kind !== 'operation.updated' &&
      event.kind !== 'tool.call.completed' &&
      event.kind !== 'tool.call.progress'
    ) {
      continue;
    }
    if (!hasSettledApprovalLifecycle(event)) {
      continue;
    }

    const args = readEventToolArguments(event);
    const approvalId = resolveBirdCoderCodeEngineApprovalId({
      payload: event.payload,
      toolArguments: args,
    });
    const checkpointId = resolveBirdCoderCodeEngineCheckpointId({
      payload: event.payload,
      toolArguments: args,
    });

    if (approvalId) {
      settledKeys.add(`approval:${approvalId}`);
    }
    if (checkpointId) {
      settledKeys.add(`checkpoint:${checkpointId}`);
    }
  }

  return settledKeys;
}

export function deriveCodingSessionPendingApprovals(
  projection: BirdCoderCodingSessionProjection,
): BirdCoderCodingSessionPendingApproval[] {
  const settledApprovalKeys = deriveSettledApprovalKeys(projection.events);
  const eventsByLatest = [...projection.events]
    .sort(compareCodingSessionEventChronology)
    .reverse();

  const approvals = [...projection.checkpoints]
    .sort(compareCodingSessionCheckpointChronology)
    .filter((checkpoint) => checkpoint.checkpointKind === 'approval' && checkpoint.resumable)
    .map<BirdCoderCodingSessionPendingApproval | null>((checkpoint) => {
      const state = checkpoint.state ?? {};
      const approvalId = resolveBirdCoderCodeEngineApprovalId({
        checkpointState: state,
      });
      if (!approvalId) {
        return null;
      }
      if (
        settledApprovalKeys.has(`approval:${approvalId}`) ||
        settledApprovalKeys.has(`checkpoint:${checkpoint.id}`)
      ) {
        return null;
      }

      const approvalEvent = eventsByLatest.find((event) => {
        const eventApprovalId = resolveBirdCoderCodeEngineApprovalId({
          payload: event.payload,
          toolArguments: readEventToolArguments(event),
        });
        return (
          event.kind === 'approval.required' &&
          (eventApprovalId === approvalId || event.runtimeId === checkpoint.runtimeId)
        );
      });
      const runtimeId =
        readStringRecordField(state, 'runtimeId') ??
        checkpoint.runtimeId ??
        approvalEvent?.runtimeId ??
        undefined;
      const turnId =
        readStringRecordField(state, 'turnId') ?? approvalEvent?.turnId ?? undefined;
      const artifactWithOperation = projection.artifacts.find(
        (artifact) => artifact.turnId === turnId && readArtifactOperationId(artifact),
      );
      const derivedOperationId = artifactWithOperation
        ? readArtifactOperationId(artifactWithOperation)
        : undefined;
      const operationId =
        readStringRecordField(state, 'operationId') ??
        readStringRecordField(approvalEvent?.payload, 'operationId') ??
        derivedOperationId;
      const artifactIds = projection.artifacts
        .filter(
          (artifact) =>
            artifact.turnId === turnId || readArtifactOperationId(artifact) === operationId,
        )
        .map((artifact) => artifact.id);

      return {
        approvalId,
        artifactIds,
        checkpointId: checkpoint.id,
        codingSessionId: checkpoint.codingSessionId,
        operationId,
        reason: readStringRecordField(state, 'reason'),
        runtimeId,
        turnId,
      } satisfies BirdCoderCodingSessionPendingApproval;
    })
    .filter((approval): approval is BirdCoderCodingSessionPendingApproval => approval !== null);
  return normalizePendingApprovals(approvals);
}

export function deriveCodingSessionPendingUserQuestions(
  projection: BirdCoderCodingSessionProjection,
): BirdCoderCodingSessionPendingUserQuestion[] {
  const settledKeys = deriveSettledUserQuestionKeys(projection.events);
  const pendingByQuestionKey = new Map<string, BirdCoderCodingSessionPendingUserQuestion>();

  for (const event of [...projection.events]
    .sort(compareCodingSessionEventChronology)
    .filter(isUserQuestionEvent)) {
    const args = readEventToolArguments(event);
    const questions = readUserQuestionPrompts(args);
    if (questions.length === 0) {
      continue;
    }

    const { questionId, toolCallId } = readUserQuestionEventIdentity(event);
    if (!questionId) {
      continue;
    }
    if (
      settledKeys.has(`question:${questionId}`) ||
      (toolCallId ? settledKeys.has(`tool:${toolCallId}`) : false)
    ) {
      continue;
    }

    const key = toolCallId ? `tool:${toolCallId}` : `question:${questionId}`;
    pendingByQuestionKey.set(key, {
      questionId,
      checkpointId: undefined,
      codingSessionId: event.codingSessionId,
      prompt: questions[0]?.question ?? questionId,
      runtimeId: event.runtimeId,
      toolCallId,
      turnId: event.turnId,
      questions,
    });
  }

  return normalizePendingUserQuestions([...pendingByQuestionKey.values()]);
}

export async function loadCodingSessionProjection(
  coreReadService: Pick<
    ICoreReadService,
    | 'getCodingSession'
    | 'listCodingSessionArtifacts'
    | 'listCodingSessionCheckpoints'
    | 'listCodingSessionEvents'
  >,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionProjection> {
  const [session, events, artifacts, checkpoints] = await Promise.all([
    coreReadService.getCodingSession(codingSessionId),
    coreReadService.listCodingSessionEvents(codingSessionId),
    coreReadService.listCodingSessionArtifacts(codingSessionId),
    coreReadService.listCodingSessionCheckpoints(codingSessionId),
  ]);

  return {
    artifacts,
    checkpoints,
    events,
    session,
  };
}

type BirdCoderCodingSessionApprovalReader = Pick<
  ICoreReadService,
  'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
>;

export async function loadCodingSessionApprovalState(
  coreReadService: BirdCoderCodingSessionApprovalReader,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionPendingApproval[]> {
  const projection = await loadCodingSessionProjection(coreReadService, codingSessionId);
  return deriveCodingSessionPendingApprovals(projection);
}

export async function loadCodingSessionUserQuestionState(
  coreReadService: BirdCoderCodingSessionApprovalReader,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionPendingUserQuestion[]> {
  const projection = await loadCodingSessionProjection(coreReadService, codingSessionId);
  return deriveCodingSessionPendingUserQuestions(projection);
}

export async function loadCodingSessionPendingInteractionState(
  coreReadService: BirdCoderCodingSessionApprovalReader,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionPendingInteractions> {
  const projection = await loadCodingSessionProjection(coreReadService, codingSessionId);
  return normalizePendingInteractions({
    approvals: deriveCodingSessionPendingApprovals(projection),
    questions: deriveCodingSessionPendingUserQuestions(projection),
  });
}

export async function submitCodingSessionApprovalDecision(
  coreWriteService: Pick<ICoreWriteService, 'submitApprovalDecision'>,
  approvalId: string,
  request: BirdCoderSubmitApprovalDecisionRequest,
): Promise<BirdCoderApprovalDecisionResult> {
  return coreWriteService.submitApprovalDecision(approvalId, request);
}

export async function submitCodingSessionUserQuestionAnswer(
  coreWriteService: Pick<ICoreWriteService, 'submitUserQuestionAnswer'>,
  questionId: string,
  request: BirdCoderSubmitUserQuestionAnswerRequest,
): Promise<BirdCoderUserQuestionAnswerResult> {
  return coreWriteService.submitUserQuestionAnswer(questionId, request);
}

export function useCodingSessionProjection(
  codingSessionId?: string | null,
  refreshToken?: string | number | null,
) {
  const { coreReadService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionProjectionState>(INITIAL_STATE);
  const latestRefreshTokenRef = useRef(0);
  const latestCodingSessionIdRef = useRef<string | null>(null);

  const refreshProjection = useCallback(async () => {
    if (!codingSessionId) {
      latestRefreshTokenRef.current += 1;
      latestCodingSessionIdRef.current = null;
      setState(INITIAL_STATE);
      return EMPTY_PROJECTION;
    }
    const didSwitchCodingSession = latestCodingSessionIdRef.current !== codingSessionId;
    latestCodingSessionIdRef.current = codingSessionId;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;

    setState((current) => (
      didSwitchCodingSession
        ? {
            ...EMPTY_PROJECTION,
            isLoading: true,
          }
        : {
            ...current,
            isLoading: true,
          }
    ));

    try {
      const projection = await loadCodingSessionProjection(coreReadService, codingSessionId);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState({
          ...projection,
          isLoading: false,
        });
      }
      return projection;
    } catch (error) {
      console.error('Failed to load coding session projection', error);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState((current) => ({
          ...current,
          isLoading: false,
        }));
      }
      return {
        ...EMPTY_PROJECTION,
      };
    }
  }, [codingSessionId, coreReadService]);

  useEffect(() => {
    void refreshProjection();
  }, [refreshProjection, refreshToken]);

  const visibleState =
    codingSessionId && latestCodingSessionIdRef.current === codingSessionId
      ? state
      : INITIAL_STATE;

  return {
    ...visibleState,
    refreshProjection,
  };
}

export function useCodingSessionApprovalState(
  codingSessionId?: string | null,
  refreshToken?: string | number | null,
) {
  const { coreReadService, coreWriteService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionApprovalState>(INITIAL_APPROVAL_STATE);
  const latestRefreshTokenRef = useRef(0);
  const latestCodingSessionIdRef = useRef<string | null>(null);

  const refreshApprovals = useCallback(async () => {
    if (!codingSessionId) {
      latestRefreshTokenRef.current += 1;
      latestCodingSessionIdRef.current = null;
      setState(INITIAL_APPROVAL_STATE);
      return EMPTY_APPROVALS;
    }
    const didSwitchCodingSession = latestCodingSessionIdRef.current !== codingSessionId;
    latestCodingSessionIdRef.current = codingSessionId;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;

    setState((current) => (
      didSwitchCodingSession
        ? {
            approvals: EMPTY_APPROVALS,
            isLoading: true,
          }
        : {
            ...current,
            isLoading: true,
          }
    ));

    try {
      const approvals = await loadCodingSessionApprovalState(coreReadService, codingSessionId);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState({
          approvals,
          isLoading: false,
        });
      }
      return approvals;
    } catch (error) {
      console.error('Failed to load coding session approvals', error);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState((current) => ({
          ...current,
          isLoading: false,
        }));
      }
      return EMPTY_APPROVALS;
    }
  }, [codingSessionId, coreReadService]);

  const submitApprovalDecision = useCallback(
    async (approvalId: string, request: BirdCoderSubmitApprovalDecisionRequest) => {
      const decision = await submitCodingSessionApprovalDecision(coreWriteService, approvalId, request);
      await refreshApprovals();
      return decision;
    },
    [coreWriteService, refreshApprovals],
  );

  useEffect(() => {
    void refreshApprovals();
  }, [refreshApprovals, refreshToken]);

  const visibleState =
    codingSessionId && latestCodingSessionIdRef.current === codingSessionId
      ? state
      : INITIAL_APPROVAL_STATE;

  return {
    ...visibleState,
    refreshApprovals,
    submitApprovalDecision,
  };
}

export function useCodingSessionPendingInteractionState(
  codingSessionId?: string | null,
  refreshToken?: string | number | null,
) {
  const { coreReadService, coreWriteService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionPendingInteractionState>(
    INITIAL_PENDING_INTERACTION_STATE,
  );
  const latestRefreshTokenRef = useRef(0);
  const latestCodingSessionIdRef = useRef<string | null>(null);

  const refreshPendingInteractions = useCallback(async () => {
    if (!codingSessionId) {
      latestRefreshTokenRef.current += 1;
      latestCodingSessionIdRef.current = null;
      setState(INITIAL_PENDING_INTERACTION_STATE);
      return EMPTY_PENDING_INTERACTIONS;
    }
    const didSwitchCodingSession = latestCodingSessionIdRef.current !== codingSessionId;
    latestCodingSessionIdRef.current = codingSessionId;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;

    setState((current) => (
      didSwitchCodingSession
        ? {
            ...EMPTY_PENDING_INTERACTIONS,
            isLoading: true,
          }
        : {
            ...current,
            isLoading: true,
          }
    ));

    try {
      const pendingInteractions = await loadCodingSessionPendingInteractionState(
        coreReadService,
        codingSessionId,
      );
      if (latestRefreshTokenRef.current === refreshToken) {
        setState({
          ...pendingInteractions,
          isLoading: false,
        });
      }
      return pendingInteractions;
    } catch (error) {
      console.error('Failed to load coding session pending interactions', error);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState((current) => ({
          ...current,
          isLoading: false,
        }));
      }
      return EMPTY_PENDING_INTERACTIONS;
    }
  }, [codingSessionId, coreReadService]);

  const submitApprovalDecision = useCallback(
    async (approvalId: string, request: BirdCoderSubmitApprovalDecisionRequest) => {
      const decision = await submitCodingSessionApprovalDecision(coreWriteService, approvalId, request);
      await refreshPendingInteractions();
      return decision;
    },
    [coreWriteService, refreshPendingInteractions],
  );

  const submitUserQuestionAnswer = useCallback(
    async (questionId: string, request: BirdCoderSubmitUserQuestionAnswerRequest) => {
      const answer = await submitCodingSessionUserQuestionAnswer(
        coreWriteService,
        questionId,
        request,
      );
      await refreshPendingInteractions();
      return answer;
    },
    [coreWriteService, refreshPendingInteractions],
  );

  useEffect(() => {
    void refreshPendingInteractions();
  }, [refreshPendingInteractions, refreshToken]);

  const visibleState =
    codingSessionId && latestCodingSessionIdRef.current === codingSessionId
      ? state
      : INITIAL_PENDING_INTERACTION_STATE;

  return {
    ...visibleState,
    refreshPendingInteractions,
    submitApprovalDecision,
    submitUserQuestionAnswer,
  };
}

export function useCodingSessionUserQuestionState(
  codingSessionId?: string | null,
  refreshToken?: string | number | null,
) {
  const { coreReadService, coreWriteService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionUserQuestionState>(
    INITIAL_USER_QUESTION_STATE,
  );
  const latestRefreshTokenRef = useRef(0);
  const latestCodingSessionIdRef = useRef<string | null>(null);

  const refreshQuestions = useCallback(async () => {
    if (!codingSessionId) {
      latestRefreshTokenRef.current += 1;
      latestCodingSessionIdRef.current = null;
      setState(INITIAL_USER_QUESTION_STATE);
      return EMPTY_USER_QUESTIONS;
    }
    const didSwitchCodingSession = latestCodingSessionIdRef.current !== codingSessionId;
    latestCodingSessionIdRef.current = codingSessionId;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;

    setState((current) => (
      didSwitchCodingSession
        ? {
            questions: EMPTY_USER_QUESTIONS,
            isLoading: true,
          }
        : {
            ...current,
            isLoading: true,
          }
    ));

    try {
      const questions = await loadCodingSessionUserQuestionState(coreReadService, codingSessionId);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState({
          questions,
          isLoading: false,
        });
      }
      return questions;
    } catch (error) {
      console.error('Failed to load coding session user questions', error);
      if (latestRefreshTokenRef.current === refreshToken) {
        setState((current) => ({
          ...current,
          isLoading: false,
        }));
      }
      return EMPTY_USER_QUESTIONS;
    }
  }, [codingSessionId, coreReadService]);

  const submitUserQuestionAnswer = useCallback(
    async (questionId: string, request: BirdCoderSubmitUserQuestionAnswerRequest) => {
      const answer = await submitCodingSessionUserQuestionAnswer(
        coreWriteService,
        questionId,
        request,
      );
      await refreshQuestions();
      return answer;
    },
    [coreWriteService, refreshQuestions],
  );

  useEffect(() => {
    void refreshQuestions();
  }, [refreshQuestions, refreshToken]);

  const visibleState =
    codingSessionId && latestCodingSessionIdRef.current === codingSessionId
      ? state
      : INITIAL_USER_QUESTION_STATE;

  return {
    ...visibleState,
    refreshQuestions,
    submitUserQuestionAnswer,
  };
}
