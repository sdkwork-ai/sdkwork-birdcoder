import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AgentTurnInputQueueEntry,
  CreateAgentTurnInputQueueEntryRequest,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { uuid } from '@sdkwork/utils/id';

import {
  useWorkbenchAgentTurnInputQueueProjection,
} from '../chat/agentTurnInputQueueStore.ts';
import { useIDEServices } from '../context/IDEContext.ts';

const QUEUE_CLAIM_LEASE_SECONDS = 30;
const QUEUE_RECONCILIATION_INTERVAL_MS = 2_000;
const QUEUE_PROCESSING_ITERATION_LIMIT = 34;
const QUEUE_BROADCAST_CHANNEL = 'birdcoder-agent-turn-input-queue-v1';

export type WorkbenchQueuedTurnDispatchOutcome =
  | 'completed'
  | 'accepted_uncertain'
  | 'rejected';

export interface WorkbenchAgentTurnInputQueueError {
  error: unknown;
  operation: 'claim' | 'clear' | 'create' | 'hydrate' | 'remove' | 'reorder' | 'retry' | 'update';
}

interface UseAgentTurnInputQueueOptions {
  agentId?: string;
  disabled: boolean;
  isActive: boolean;
  isTurnBusy: boolean;
  onDispatch: (
    entry: AgentTurnInputQueueEntry,
  ) => Promise<WorkbenchQueuedTurnDispatchOutcome>;
  onError?: (event: WorkbenchAgentTurnInputQueueError) => void;
  pausedQueueEntryId?: string | null;
  scopeKey?: string;
  sessionId?: string;
}

interface QueueBroadcastMessage {
  agentId: string;
  sessionId: string;
  sourceId: string;
}

type QueueCreateRequest = Omit<CreateAgentTurnInputQueueEntryRequest, 'requestedAt'>;

interface PendingQueueCreateAttempt {
  fingerprint: string;
  queueEntryId: string;
}

function isQueueBroadcastMessage(value: unknown): value is QueueBroadcastMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<QueueBroadcastMessage>;
  return typeof candidate.agentId === 'string'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.sourceId === 'string';
}

function toRequestedAt(): string {
  return new Date().toISOString();
}

function createQueueRequestFingerprint(
  identityKey: string,
  request: QueueCreateRequest,
): string {
  return JSON.stringify({
    accessModeId: request.accessModeId?.trim() || null,
    attachmentNames: (request.attachmentNames ?? []).map((name) => name.trim()),
    content: request.content.trim(),
    contentType: request.contentType?.trim() || 'text/plain',
    displayText: request.displayText?.trim() ?? '',
    driveRefs: (request.driveRefs ?? []).map((driveRef) => ({
      driveNodeId: driveRef.driveNodeId.trim(),
      driveSpaceId: driveRef.driveSpaceId.trim(),
      resourceRole: driveRef.resourceRole,
    })),
    identityKey,
    requestedModelId: request.requestedModelId?.trim() || null,
    runtimeBindingId: request.runtimeBindingId?.trim() || null,
    turnMode: request.turnMode,
  });
}

export function useAgentTurnInputQueue({
  agentId,
  disabled,
  isActive,
  isTurnBusy,
  onDispatch,
  onError,
  pausedQueueEntryId,
  scopeKey,
  sessionId,
}: UseAgentTurnInputQueueOptions) {
  const { agentSessionService } = useIDEServices();
  const normalizedAgentId = agentId?.trim() ?? '';
  const normalizedSessionId = sessionId?.trim() ?? '';
  const normalizedScopeKey = scopeKey?.trim() || normalizedSessionId;
  const identityKey = normalizedAgentId && normalizedSessionId
    ? `${normalizedAgentId}\u0001${normalizedSessionId}`
    : '';
  const identity = useMemo(() => identityKey ? {
    agentId: normalizedAgentId,
    sessionId: normalizedSessionId,
  } : null, [identityKey, normalizedAgentId, normalizedSessionId]);
  const {
    queuedTurnInputs,
    removeQueuedTurnInputProjection,
    replaceQueuedTurnInputProjection,
    upsertQueuedTurnInputProjection,
  } = useWorkbenchAgentTurnInputQueueProjection(normalizedScopeKey);

  const sourceIdRef = useRef(`queue-client.${uuid()}`);
  const claimOwnerRef = useRef(`birdcoder-${uuid()}`);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const processingRef = useRef(false);
  const mutationRef = useRef<symbol | null>(null);
  const reconciliationTimerRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const hydrationRequestRef = useRef(0);
  const projectionMutationEpochRef = useRef(0);
  const pendingCreateAttemptRef = useRef<PendingQueueCreateAttempt | null>(null);
  const processingPausedRef = useRef(false);
  const dispatchRef = useRef(onDispatch);
  const errorRef = useRef(onError);
  const [hydratedIdentityKey, setHydratedIdentityKey] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [processVersion, setProcessVersion] = useState(0);

  dispatchRef.current = onDispatch;
  errorRef.current = onError;
  processingPausedRef.current = disabled
    || !isActive
    || isTurnBusy
    || Boolean(pausedQueueEntryId?.trim());

  const reportError = useCallback((
    operation: WorkbenchAgentTurnInputQueueError['operation'],
    error: unknown,
  ) => {
    errorRef.current?.({ error, operation });
  }, []);

  const requestProcessing = useCallback(() => {
    setProcessVersion((version) => version + 1);
  }, []);

  const clearReconciliationTimer = useCallback(() => {
    if (reconciliationTimerRef.current !== null) {
      window.clearTimeout(reconciliationTimerRef.current);
      reconciliationTimerRef.current = null;
    }
  }, []);

  const scheduleReconciliation = useCallback(() => {
    clearReconciliationTimer();
    reconciliationTimerRef.current = window.setTimeout(() => {
      reconciliationTimerRef.current = null;
      requestProcessing();
    }, QUEUE_RECONCILIATION_INTERVAL_MS);
  }, [clearReconciliationTimer, requestProcessing]);

  const broadcastMutation = useCallback(() => {
    if (!identity) {
      return;
    }
    broadcastChannelRef.current?.postMessage({
      ...identity,
      sourceId: sourceIdRef.current,
    } satisfies QueueBroadcastMessage);
  }, [identity]);

  const hydrate = useCallback(async (signal?: AbortSignal) => {
    if (!identity || !normalizedScopeKey) {
      return;
    }
    const generation = generationRef.current;
    const hydrationRequest = hydrationRequestRef.current + 1;
    hydrationRequestRef.current = hydrationRequest;
    const projectionMutationEpoch = projectionMutationEpochRef.current;
    try {
      const page = await agentSessionService.listTurnInputQueueEntries(
        identity,
        { signal },
      );
      if (
        signal?.aborted
        || generation !== generationRef.current
        || hydrationRequest !== hydrationRequestRef.current
        || projectionMutationEpoch !== projectionMutationEpochRef.current
        || mutationRef.current !== null
        || processingRef.current
      ) {
        return;
      }
      replaceQueuedTurnInputProjection(page.items);
      setHydratedIdentityKey(identityKey);
      requestProcessing();
    } catch (error) {
      if (
        !signal?.aborted
        && generation === generationRef.current
        && hydrationRequest === hydrationRequestRef.current
        && projectionMutationEpoch === projectionMutationEpochRef.current
        && mutationRef.current === null
        && !processingRef.current
      ) {
        reportError('hydrate', error);
      }
    }
  }, [
    agentSessionService,
    identity,
    identityKey,
    normalizedScopeKey,
    replaceQueuedTurnInputProjection,
    reportError,
    requestProcessing,
  ]);

  useEffect(() => {
    generationRef.current += 1;
    hydrationRequestRef.current += 1;
    projectionMutationEpochRef.current += 1;
    clearReconciliationTimer();
    processingRef.current = false;
    mutationRef.current = null;
    setIsMutating(false);
    setHydratedIdentityKey('');
    if (!identity) {
      return undefined;
    }

    const controller = new AbortController();
    void hydrate(controller.signal);
    return () => controller.abort();
  }, [clearReconciliationTimer, hydrate, identity]);

  useEffect(() => {
    if (!identity || typeof BroadcastChannel === 'undefined') {
      return undefined;
    }
    const channel = new BroadcastChannel(QUEUE_BROADCAST_CHANNEL);
    broadcastChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (
        isQueueBroadcastMessage(event.data)
        && event.data.sourceId !== sourceIdRef.current
        && event.data.agentId === identity.agentId
        && event.data.sessionId === identity.sessionId
      ) {
        void hydrate();
      }
    };
    return () => {
      if (broadcastChannelRef.current === channel) {
        broadcastChannelRef.current = null;
      }
      channel.close();
    };
  }, [hydrate, identity]);

  useEffect(() => {
    if (!identity) {
      return undefined;
    }
    const refresh = () => void hydrate();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void hydrate();
      }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [hydrate, identity]);

  useEffect(() => () => clearReconciliationTimer(), [clearReconciliationTimer]);

  const runMutation = useCallback(async <T,>(
    operation: WorkbenchAgentTurnInputQueueError['operation'],
    mutation: (isCurrent: () => boolean) => Promise<T>,
  ): Promise<T> => {
    if (mutationRef.current !== null) {
      throw new Error('An Agent Turn input queue mutation is already in progress.');
    }
    const generation = generationRef.current;
    const mutationToken = Symbol(operation);
    let shouldRehydrate = false;
    mutationRef.current = mutationToken;
    projectionMutationEpochRef.current += 1;
    setIsMutating(true);
    try {
      return await mutation(() => generation === generationRef.current);
    } catch (error) {
      if (generation === generationRef.current) {
        reportError(operation, error);
        shouldRehydrate = true;
      }
      throw error;
    } finally {
      if (mutationRef.current === mutationToken) {
        mutationRef.current = null;
        setIsMutating(false);
      }
      if (generation === generationRef.current) {
        projectionMutationEpochRef.current += 1;
        if (shouldRehydrate) {
          void hydrate();
        }
      }
    }
  }, [hydrate, reportError]);

  const enqueue = useCallback(async (
    request: QueueCreateRequest,
  ) => {
    if (!identity) {
      throw new Error('An Agent and Session are required to queue a Turn input.');
    }
    const fingerprint = createQueueRequestFingerprint(identityKey, request);
    const explicitQueueEntryId = request.queueEntryId?.trim() ?? '';
    const pendingAttempt = pendingCreateAttemptRef.current;
    const queueEntryId = explicitQueueEntryId
      || (pendingAttempt?.fingerprint === fingerprint
        ? pendingAttempt.queueEntryId
        : `queue-entry.${uuid()}`);
    if (!explicitQueueEntryId && pendingAttempt?.fingerprint !== fingerprint) {
      pendingCreateAttemptRef.current = { fingerprint, queueEntryId };
    }

    const entry = await runMutation('create', async (isCurrent) => {
      const entry = await agentSessionService.createTurnInputQueueEntry(identity, {
        ...request,
        queueEntryId,
        requestedAt: toRequestedAt(),
      });
      if (isCurrent()) {
        upsertQueuedTurnInputProjection(entry);
        broadcastMutation();
        requestProcessing();
      }
      return entry;
    });
    if (
      pendingCreateAttemptRef.current?.fingerprint === fingerprint
      && pendingCreateAttemptRef.current.queueEntryId === queueEntryId
    ) {
      pendingCreateAttemptRef.current = null;
    }
    return entry;
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    requestProcessing,
    runMutation,
    upsertQueuedTurnInputProjection,
  ]);

  const update = useCallback(async (
    entry: AgentTurnInputQueueEntry,
    content: string,
    displayText: string,
  ) => {
    if (!identity) {
      throw new Error('An Agent and Session are required to update a queued Turn input.');
    }
    return runMutation('update', async (isCurrent) => {
      const updatedEntry = await agentSessionService.updateTurnInputQueueEntry(
        identity,
        entry.queueEntryId,
        {
          accessModeId: entry.accessModeId,
          attachmentNames: [...entry.attachmentNames],
          content,
          contentType: entry.contentType,
          displayText,
          driveRefs: [...entry.driveRefs],
          expectedVersion: entry.version,
          requestedAt: toRequestedAt(),
          requestedModelId: entry.requestedModelId,
          runtimeBindingId: entry.runtimeBindingId,
          turnMode: entry.turnMode,
        },
      );
      if (isCurrent()) {
        upsertQueuedTurnInputProjection(updatedEntry);
        broadcastMutation();
        requestProcessing();
      }
      return updatedEntry;
    });
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    requestProcessing,
    runMutation,
    upsertQueuedTurnInputProjection,
  ]);

  const remove = useCallback(async (entry: AgentTurnInputQueueEntry) => {
    if (!identity) {
      throw new Error('An Agent and Session are required to remove a queued Turn input.');
    }
    return runMutation('remove', async (isCurrent) => {
      await agentSessionService.removeTurnInputQueueEntry(
        identity,
        entry.queueEntryId,
        entry.version,
      );
      if (isCurrent()) {
        removeQueuedTurnInputProjection(entry.queueEntryId);
        broadcastMutation();
        requestProcessing();
      }
    });
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    removeQueuedTurnInputProjection,
    requestProcessing,
    runMutation,
  ]);

  const clear = useCallback(async () => {
    if (!identity) {
      throw new Error('An Agent and Session are required to clear queued Turn inputs.');
    }
    return runMutation('clear', async (isCurrent) => {
      await agentSessionService.clearTurnInputQueueEntries(identity);
      if (!isCurrent()) {
        return;
      }
      const page = await agentSessionService.listTurnInputQueueEntries(identity);
      if (isCurrent()) {
        replaceQueuedTurnInputProjection(page.items);
        broadcastMutation();
        requestProcessing();
      }
    });
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    replaceQueuedTurnInputProjection,
    requestProcessing,
    runMutation,
  ]);

  const reorder = useCallback(async (orderedEntries: readonly AgentTurnInputQueueEntry[]) => {
    if (!identity) {
      throw new Error('An Agent and Session are required to reorder queued Turn inputs.');
    }
    return runMutation('reorder', async (isCurrent) => {
      const entries = await agentSessionService.reorderTurnInputQueueEntries(identity, {
        orderedEntries: orderedEntries
          .filter((entry) => entry.status !== 'executing')
          .map((entry) => ({
            expectedVersion: entry.version,
            queueEntryId: entry.queueEntryId,
          })),
        requestedAt: toRequestedAt(),
      });
      if (isCurrent()) {
        replaceQueuedTurnInputProjection(entries);
        broadcastMutation();
        requestProcessing();
      }
    });
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    replaceQueuedTurnInputProjection,
    requestProcessing,
    runMutation,
  ]);

  const retry = useCallback(async (entry: AgentTurnInputQueueEntry) => {
    if (!identity) {
      throw new Error('An Agent and Session are required to retry a queued Turn input.');
    }
    return runMutation('retry', async (isCurrent) => {
      const retriedEntry = await agentSessionService.retryTurnInputQueueEntry(
        identity,
        entry.queueEntryId,
        { expectedVersion: entry.version, requestedAt: toRequestedAt() },
      );
      if (isCurrent()) {
        upsertQueuedTurnInputProjection(retriedEntry);
        broadcastMutation();
        requestProcessing();
      }
      return retriedEntry;
    });
  }, [
    agentSessionService,
    broadcastMutation,
    identity,
    requestProcessing,
    runMutation,
    upsertQueuedTurnInputProjection,
  ]);

  useEffect(() => {
    if (
      !identity
      || hydratedIdentityKey !== identityKey
      || disabled
      || !isActive
      || isTurnBusy
      || processingRef.current
      || queuedTurnInputs.length === 0
      || processingPausedRef.current
    ) {
      return;
    }

    const generation = generationRef.current;
    processingRef.current = true;
    projectionMutationEpochRef.current += 1;
    void (async () => {
      let shouldRehydrate = false;
      try {
        for (let iteration = 0; iteration < QUEUE_PROCESSING_ITERATION_LIMIT; iteration += 1) {
          if (generation !== generationRef.current || processingPausedRef.current) {
            return;
          }
          const claim = await agentSessionService.claimNextTurnInputQueueEntry(identity, {
            claimOwner: claimOwnerRef.current,
            leaseSeconds: QUEUE_CLAIM_LEASE_SECONDS,
            requestedAt: toRequestedAt(),
          });
          if (generation !== generationRef.current) {
            return;
          }

          if (claim.entry) {
            upsertQueuedTurnInputProjection(claim.entry);
          }
          if (claim.outcome === 'empty') {
            replaceQueuedTurnInputProjection([]);
            broadcastMutation();
            return;
          }
          if (claim.outcome === 'blocked') {
            return;
          }
          if (claim.outcome === 'busy' || claim.outcome === 'active_turn') {
            scheduleReconciliation();
            return;
          }
          if (!claim.entry || !claim.claimToken) {
            throw new Error('Claimed Agent Turn input is missing its queue entry or claim token.');
          }

          const dispatchOutcome = await dispatchRef.current(claim.entry);
          if (generation !== generationRef.current) {
            return;
          }
          if (dispatchOutcome === 'rejected') {
            const failedEntry = await agentSessionService.failTurnInputQueueEntry(
              identity,
              claim.entry.queueEntryId,
              {
                claimToken: claim.claimToken,
                errorCode: 'turn_dispatch_rejected',
                errorDetail: 'Turn delivery was rejected before authoritative acceptance.',
                expectedVersion: claim.entry.version,
                fencingToken: claim.entry.fencingToken,
                requestedAt: toRequestedAt(),
              },
            );
            upsertQueuedTurnInputProjection(failedEntry);
            broadcastMutation();
            return;
          }
          if (dispatchOutcome === 'accepted_uncertain') {
            scheduleReconciliation();
            return;
          }
          // The next claim atomically reconciles this completed Turn before leasing the next entry.
        }
        scheduleReconciliation();
      } catch (error) {
        if (generation !== generationRef.current) {
          return;
        }
        reportError('claim', error);
        scheduleReconciliation();
        shouldRehydrate = true;
      } finally {
        if (generation === generationRef.current) {
          processingRef.current = false;
          projectionMutationEpochRef.current += 1;
          if (shouldRehydrate) {
            void hydrate();
          }
        }
      }
    })();
  }, [
    agentSessionService,
    broadcastMutation,
    disabled,
    hydrate,
    hydratedIdentityKey,
    identity,
    identityKey,
    isActive,
    isTurnBusy,
    pausedQueueEntryId,
    processVersion,
    queuedTurnInputs,
    replaceQueuedTurnInputProjection,
    reportError,
    scheduleReconciliation,
    upsertQueuedTurnInputProjection,
  ]);

  return {
    clear,
    enqueue,
    isHydrated: hydratedIdentityKey === identityKey && Boolean(identityKey),
    isMutating,
    queuedTurnInputs,
    refresh: hydrate,
    remove,
    reorder,
    retry,
    update,
  };
}
