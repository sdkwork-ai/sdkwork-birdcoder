import { useCallback, useEffect, useRef, useState } from 'react';

import { getStoredJson, setStoredJson } from '../storage/localStore.ts';

type StateUpdater<T> = T | ((previousState: T) => T);

export function usePersistedState<T>(
  scope: string,
  key: string,
  initialValue: T,
): readonly [T, (value: StateUpdater<T>) => void, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const lastPersistedStateRef = useRef<T>(initialValue);

  useEffect(() => {
    let isMounted = true;

    void getStoredJson(scope, key, initialValue)
      .then((persistedValue) => {
        if (!isMounted) {
          return;
        }

        lastPersistedStateRef.current = persistedValue;
        setState(persistedValue);
        setIsHydrated(true);
      })
      .catch(() => {
        if (isMounted) {
          lastPersistedStateRef.current = initialValue;
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialValue, key, scope]);

  useEffect(() => {
    if (!isHydrated || Object.is(lastPersistedStateRef.current, state)) {
      return;
    }

    lastPersistedStateRef.current = state;
    void setStoredJson(scope, key, state);
  }, [isHydrated, key, scope, state]);

  const setPersistedState = useCallback(
    (value: StateUpdater<T>) => {
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
