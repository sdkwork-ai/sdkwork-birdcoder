import { useCallback, useRef, useState } from 'react';

export interface PendingNewCodingSessionRequest {
  requestId: number;
  projectId: string;
}

export function useCodeNewCodingSessionRequestState() {
  const [pendingNewCodingSessionRequest, setPendingNewCodingSessionRequest] =
    useState<PendingNewCodingSessionRequest | null>(null);
  const pendingNewCodingSessionRequestIdRef = useRef(0);
  const pendingNewCodingSessionRequestRef = useRef<PendingNewCodingSessionRequest | null>(null);
  const isNewCodingSessionCreating = pendingNewCodingSessionRequest !== null;

  const clearPendingNewCodingSessionRequest = useCallback((requestId?: number) => {
    if (
      requestId === undefined ||
      pendingNewCodingSessionRequestRef.current?.requestId === requestId
    ) {
      pendingNewCodingSessionRequestRef.current = null;
    }

    setPendingNewCodingSessionRequest((previousRequest) =>
      requestId !== undefined && previousRequest?.requestId !== requestId
        ? previousRequest
        : null,
    );
  }, []);

  const beginPendingNewCodingSessionRequest = useCallback((projectId: string) => {
    const requestId = pendingNewCodingSessionRequestIdRef.current + 1;
    pendingNewCodingSessionRequestIdRef.current = requestId;
    const pendingRequest: PendingNewCodingSessionRequest = {
      requestId,
      projectId,
    };
    pendingNewCodingSessionRequestRef.current = pendingRequest;
    setPendingNewCodingSessionRequest(pendingRequest);
    return pendingRequest;
  }, []);

  return {
    beginPendingNewCodingSessionRequest,
    clearPendingNewCodingSessionRequest,
    isNewCodingSessionCreating,
    pendingNewCodingSessionRequestRef,
  } as const;
}
