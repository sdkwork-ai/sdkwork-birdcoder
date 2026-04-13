import { useCallback, useEffect, useState } from 'react';
import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderSubmitApprovalDecisionRequest,
} from '@sdkwork/birdcoder-types';
import type { ICoreReadService, ICoreWriteService } from '@sdkwork/birdcoder-infrastructure';
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

export function deriveCodingSessionPendingApprovals(
  projection: BirdCoderCodingSessionProjection,
): BirdCoderCodingSessionPendingApproval[] {
  return projection.checkpoints
    .filter((checkpoint) => checkpoint.checkpointKind === 'approval' && checkpoint.resumable)
    .map<BirdCoderCodingSessionPendingApproval | null>((checkpoint) => {
      const state = checkpoint.state ?? {};
      const approvalId = readStringRecordField(state, 'approvalId');
      if (!approvalId) {
        return null;
      }

      const approvalEvent = [...projection.events]
        .reverse()
        .find(
          (event) =>
            event.kind === 'approval.required' &&
            (readStringRecordField(event.payload, 'approvalId') === approvalId ||
              event.runtimeId === checkpoint.runtimeId),
        );
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
  const session = await coreReadService.getCodingSession(codingSessionId);
  const [events, artifacts, checkpoints] = await Promise.all([
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

export async function submitCodingSessionApprovalDecision(
  coreWriteService: Pick<ICoreWriteService, 'submitApprovalDecision'>,
  approvalId: string,
  request: BirdCoderSubmitApprovalDecisionRequest,
): Promise<BirdCoderApprovalDecisionResult> {
  return coreWriteService.submitApprovalDecision(approvalId, request);
}

export function useCodingSessionProjection(codingSessionId?: string | null) {
  const { coreReadService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionProjectionState>(INITIAL_STATE);

  const refreshProjection = useCallback(async () => {
    if (!codingSessionId) {
      setState(INITIAL_STATE);
      return EMPTY_PROJECTION;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const projection = await loadCodingSessionProjection(coreReadService, codingSessionId);
      setState({
        ...projection,
        isLoading: false,
      });
      return projection;
    } catch (error) {
      console.error('Failed to load coding session projection', error);
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
      return {
        ...EMPTY_PROJECTION,
      };
    }
  }, [codingSessionId, coreReadService]);

  useEffect(() => {
    void refreshProjection();
  }, [refreshProjection]);

  return {
    ...state,
    refreshProjection,
  };
}

export function useCodingSessionApprovalState(codingSessionId?: string | null) {
  const { coreReadService, coreWriteService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingSessionApprovalState>(INITIAL_APPROVAL_STATE);

  const refreshApprovals = useCallback(async () => {
    if (!codingSessionId) {
      setState(INITIAL_APPROVAL_STATE);
      return EMPTY_APPROVALS;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const approvals = await loadCodingSessionApprovalState(coreReadService, codingSessionId);
      setState({
        approvals,
        isLoading: false,
      });
      return approvals;
    } catch (error) {
      console.error('Failed to load coding session approvals', error);
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
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
  }, [refreshApprovals]);

  return {
    ...state,
    refreshApprovals,
    submitApprovalDecision,
  };
}
