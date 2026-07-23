import { useCallback, useRef, useState } from 'react';

export interface PendingNewAgentSessionRequest {
  requestId: number;
  projectId: string;
}

export function useCodeNewAgentSessionRequestState() {
  const [pendingNewAgentSessionRequest, setPendingNewAgentSessionRequest] =
    useState<PendingNewAgentSessionRequest | null>(null);
  const pendingNewAgentSessionRequestIdRef = useRef(0);
  const pendingNewAgentSessionRequestRef = useRef<PendingNewAgentSessionRequest | null>(null);
  const isNewAgentSessionCreating = pendingNewAgentSessionRequest !== null;

  const clearPendingNewAgentSessionRequest = useCallback((requestId?: number) => {
    if (
      requestId === undefined ||
      pendingNewAgentSessionRequestRef.current?.requestId === requestId
    ) {
      pendingNewAgentSessionRequestRef.current = null;
    }

    setPendingNewAgentSessionRequest((previousRequest) =>
      requestId !== undefined && previousRequest?.requestId !== requestId
        ? previousRequest
        : null,
    );
  }, []);

  const beginPendingNewAgentSessionRequest = useCallback((projectId: string) => {
    const requestId = pendingNewAgentSessionRequestIdRef.current + 1;
    pendingNewAgentSessionRequestIdRef.current = requestId;
    const pendingRequest: PendingNewAgentSessionRequest = {
      requestId,
      projectId,
    };
    pendingNewAgentSessionRequestRef.current = pendingRequest;
    setPendingNewAgentSessionRequest(pendingRequest);
    return pendingRequest;
  }, []);

  return {
    beginPendingNewAgentSessionRequest,
    clearPendingNewAgentSessionRequest,
    isNewAgentSessionCreating,
    pendingNewAgentSessionRequestRef,
  } as const;
}
