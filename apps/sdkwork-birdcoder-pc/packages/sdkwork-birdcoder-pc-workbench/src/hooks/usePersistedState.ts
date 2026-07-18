import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildLocalStoreKey,
  deserializeStoredValue,
  getStoredJson,
  serializeStoredValue,
  trySetStoredRawValue,
} from '../storage/localStore.ts';

type StateUpdater<T> = T | ((previousState: T) => T);

interface PersistedStateSyncEventDetail {
  key: string;
  rawValue: string;
  scope: string;
  sourceId: number;
}

interface PendingPersistedStateWrite<T> {
  attempt: number;
  rawValue: string;
  revision: number;
  state: T;
}

const PERSISTED_STATE_SYNC_EVENT = 'sdkwork-birdcoder:persisted-state-sync';
const MAX_PERSIST_RETRIES = 3;
const PERSIST_RETRY_DELAYS_MS = [250, 1_000, 3_000] as const;
const persistedStateWriteQueues = new Map<string, Promise<void>>();
let nextPersistedStateSourceId = 1;

function emitPersistedStateSync(detail: PersistedStateSyncEventDetail): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PersistedStateSyncEventDetail>(PERSISTED_STATE_SYNC_EVENT, { detail }),
  );
}

function queuePersistedStateWrite(
  detail: PersistedStateSyncEventDetail,
): Promise<void> {
  const storageKey = buildLocalStoreKey(detail.scope, detail.key);
  const previousWrite = persistedStateWriteQueues.get(storageKey) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      const didPersist = await trySetStoredRawValue(detail.scope, detail.key, detail.rawValue);
      if (!didPersist) {
        throw new Error(`Storage rejected ${detail.scope}/${detail.key}`);
      }
      emitPersistedStateSync(detail);
    });

  persistedStateWriteQueues.set(storageKey, nextWrite);
  void nextWrite
    .finally(() => {
      if (persistedStateWriteQueues.get(storageKey) === nextWrite) {
        persistedStateWriteQueues.delete(storageKey);
      }
    })
    .catch(() => undefined);

  return nextWrite;
}

function clearRetryTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }): void {
  if (timerRef.current === null) {
    return;
  }

  clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function usePersistedState<T>(
  scope: string,
  key: string,
  initialValue: T,
): readonly [T, (value: StateUpdater<T>) => void, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceSignal, setPersistenceSignal] = useState(0);
  const lastPersistedStateRef = useRef<T>(initialValue);
  const initialValueRef = useRef(initialValue);
  const stateRef = useRef(state);
  const stateRevisionRef = useRef(0);
  const hydratedRef = useRef(false);
  const localMutationDuringHydrationRef = useRef(false);
  const storageMayBeDirtyRef = useRef(false);
  const pendingWriteRef = useRef<PendingPersistedStateWrite<T> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const storageIdentityRef = useRef(`${scope}\u0000${key}`);
  const sourceIdRef = useRef<number | null>(null);
  if (sourceIdRef.current === null) {
    sourceIdRef.current = nextPersistedStateSourceId;
    nextPersistedStateSourceId += 1;
  }
  initialValueRef.current = initialValue;
  stateRef.current = state;

  const storageIdentity = `${scope}\u0000${key}`;
  const storageIdentityChanged = storageIdentityRef.current !== storageIdentity;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRetryTimer(retryTimerRef);
      pendingWriteRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!storageIdentityChanged) {
      return;
    }

    storageIdentityRef.current = storageIdentity;
    clearRetryTimer(retryTimerRef);
    pendingWriteRef.current = null;
    stateRevisionRef.current += 1;
    localMutationDuringHydrationRef.current = false;
    storageMayBeDirtyRef.current = false;
    lastPersistedStateRef.current = initialValueRef.current;
    hydratedRef.current = false;
    setState(initialValueRef.current);
    setIsHydrated(false);
  }, [storageIdentity, storageIdentityChanged]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = buildLocalStoreKey(scope, key);
    const applyRawValue = (rawValue: string | null) => {
      const hadPendingWrite = pendingWriteRef.current !== null;
      clearRetryTimer(retryTimerRef);
      pendingWriteRef.current = null;
      storageMayBeDirtyRef.current = hadPendingWrite;

      const nextValue = deserializeStoredValue(rawValue, initialValueRef.current);
      stateRevisionRef.current += 1;
      localMutationDuringHydrationRef.current = false;
      lastPersistedStateRef.current = nextValue;
      hydratedRef.current = true;
      setState(nextValue);
      setIsHydrated(true);
      if (hadPendingWrite) {
        // A queued local write cannot be cancelled. Re-check after it drains so
        // the synchronized value remains the final value in storage.
        setPersistenceSignal((revision) => revision + 1);
      }
    };
    const handlePersistedStateSync = (event: Event) => {
      const detail = (event as CustomEvent<PersistedStateSyncEventDetail>).detail;
      if (
        !detail ||
        detail.sourceId === sourceIdRef.current ||
        detail.scope !== scope ||
        detail.key !== key
      ) {
        return;
      }

      applyRawValue(detail.rawValue);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        applyRawValue(event.newValue);
      }
    };

    window.addEventListener(PERSISTED_STATE_SYNC_EVENT, handlePersistedStateSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PERSISTED_STATE_SYNC_EVENT, handlePersistedStateSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [key, scope]);

  useEffect(() => {
    let isMounted = true;
    const hydrationRevision = stateRevisionRef.current;

    void getStoredJson(scope, key, initialValueRef.current)
      .then((persistedValue) => {
        if (!isMounted || !mountedRef.current) {
          return;
        }

        const localOrSynchronizedValueWon =
          localMutationDuringHydrationRef.current ||
          stateRevisionRef.current !== hydrationRevision;
        if (localOrSynchronizedValueWon) {
          // The user or another window changed the value while the read was in
          // flight. Keep that newer value and let the persistence effect write
          // it instead of leaving the hook permanently unhydrated.
          hydratedRef.current = true;
          setIsHydrated(true);
          return;
        }

        lastPersistedStateRef.current = persistedValue;
        storageMayBeDirtyRef.current = false;
        hydratedRef.current = true;
        setState(persistedValue);
        setIsHydrated(true);
      })
      .catch(() => {
        if (!isMounted || !mountedRef.current) {
          return;
        }

        const localOrSynchronizedValueWon =
          localMutationDuringHydrationRef.current ||
          stateRevisionRef.current !== hydrationRevision;
        if (localOrSynchronizedValueWon) {
          hydratedRef.current = true;
          setIsHydrated(true);
          return;
        }

        lastPersistedStateRef.current = initialValueRef.current;
        storageMayBeDirtyRef.current = false;
        hydratedRef.current = true;
        setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, [key, scope]);

  useEffect(() => {
    if (!isHydrated || !hydratedRef.current) {
      return;
    }

    const revision = stateRevisionRef.current;
    let rawValue: string;
    try {
      rawValue = serializeStoredValue(state);
    } catch (error) {
      storageMayBeDirtyRef.current = true;
      console.warn(`[BirdCoder Storage] Failed to serialize ${scope}/${key}:`, error);
      return;
    }

    const pendingWrite = pendingWriteRef.current;
    if (
      pendingWrite &&
      (pendingWrite.revision !== revision || pendingWrite.rawValue !== rawValue)
    ) {
      clearRetryTimer(retryTimerRef);
      pendingWriteRef.current = null;
      // The old write may still be queued, so storage cannot be assumed to
      // match the current state even when the values happen to compare equal.
      storageMayBeDirtyRef.current = true;
    }

    if (
      !storageMayBeDirtyRef.current &&
      Object.is(lastPersistedStateRef.current, state)
    ) {
      return;
    }

    const currentPendingWrite = pendingWriteRef.current;
    if (
      currentPendingWrite &&
      currentPendingWrite.revision === revision &&
      currentPendingWrite.rawValue === rawValue
    ) {
      return;
    }

    const write: PendingPersistedStateWrite<T> = {
      attempt: 0,
      rawValue,
      revision,
      state,
    };
    pendingWriteRef.current = write;
    storageMayBeDirtyRef.current = true;

    const executeWrite = () => {
      if (!mountedRef.current || pendingWriteRef.current !== write) {
        return;
      }

      void queuePersistedStateWrite({
        key,
        rawValue: write.rawValue,
        scope,
        sourceId: sourceIdRef.current ?? 0,
      })
        .then(() => {
          if (pendingWriteRef.current !== write) {
            return;
          }

          pendingWriteRef.current = null;
          lastPersistedStateRef.current = write.state;
          storageMayBeDirtyRef.current =
            stateRevisionRef.current !== write.revision ||
            !Object.is(stateRef.current, write.state);
          write.attempt = 0;
          if (mountedRef.current) {
            // A stale write can finish after the state has changed back to a
            // value that looked clean before the write completed. Re-run the
            // check so that the final value is written in that case.
            setPersistenceSignal((revision) => revision + 1);
          }
        })
        .catch((error) => {
          if (pendingWriteRef.current !== write) {
            return;
          }

          console.warn(`[BirdCoder Storage] Failed to persist ${scope}/${key}:`, error);
          if (
            stateRevisionRef.current !== write.revision ||
            !Object.is(stateRef.current, write.state)
          ) {
            pendingWriteRef.current = null;
            return;
          }

          write.attempt += 1;
          if (write.attempt > MAX_PERSIST_RETRIES) {
            pendingWriteRef.current = null;
            storageMayBeDirtyRef.current = true;
            return;
          }

          const retryDelay =
            PERSIST_RETRY_DELAYS_MS[write.attempt - 1] ?? PERSIST_RETRY_DELAYS_MS.at(-1)!;
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            executeWrite();
          }, retryDelay);
        });
    };

    executeWrite();
    return () => {
      if (pendingWriteRef.current === write) {
        clearRetryTimer(retryTimerRef);
        pendingWriteRef.current = null;
        storageMayBeDirtyRef.current = true;
      }
    };
  }, [isHydrated, key, scope, state, persistenceSignal]);

  const setPersistedState = useCallback(
    (value: StateUpdater<T>) => {
      if (!hydratedRef.current) {
        localMutationDuringHydrationRef.current = true;
        storageMayBeDirtyRef.current = true;
      }
      stateRevisionRef.current += 1;
      hydratedRef.current = true;
      setIsHydrated(true);
      setState((previousState) =>
        typeof value === 'function'
          ? (value as (currentValue: T) => T)(previousState)
          : value,
      );
    },
    [],
  );

  return [state, setPersistedState, isHydrated] as const;
}
