import { useCallback, useEffect, useState } from 'react';

import { getStoredJson, setStoredJson } from '../storage/localStore.ts';

type StateUpdater<T> = T | ((previousState: T) => T);

export function usePersistedState<T>(
  scope: string,
  key: string,
  initialValue: T,
): readonly [T, (value: StateUpdater<T>) => void, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getStoredJson(scope, key, initialValue)
      .then((persistedValue) => {
        if (!isMounted) {
          return;
        }

        setState(persistedValue);
        setIsHydrated(true);
      })
      .catch(() => {
        if (isMounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialValue, key, scope]);

  const setPersistedState = useCallback(
    (value: StateUpdater<T>) => {
      setState((previousState) => {
        const nextState =
          typeof value === 'function'
            ? (value as (currentValue: T) => T)(previousState)
            : value;
        void setStoredJson(scope, key, nextState);
        return nextState;
      });
    },
    [key, scope],
  );

  return [state, setPersistedState, isHydrated] as const;
}
