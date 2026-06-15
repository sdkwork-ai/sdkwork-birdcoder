import { useCallback, useEffect, useState } from 'react';

import {
  ensureStoredRunConfigurations,
  getDefaultRunConfigurations,
  type RunConfigurationRecord,
  upsertStoredRunConfiguration,
} from '../terminal/runConfigs.ts';

export function useProjectRunConfigurations(projectId: string | null | undefined) {
  const [runConfigurations, setRunConfigurations] = useState<RunConfigurationRecord[]>(
    getDefaultRunConfigurations(),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsHydrated(false);

    void ensureStoredRunConfigurations(projectId)
      .then((configurations) => {
        if (!isMounted) {
          return;
        }

        setRunConfigurations(configurations);
        setIsHydrated(true);
      })
      .catch(() => {
        if (isMounted) {
          setRunConfigurations(getDefaultRunConfigurations());
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const saveRunConfiguration = useCallback(
    async (configuration: RunConfigurationRecord) => {
      const configurations = await upsertStoredRunConfiguration(projectId, configuration);
      setRunConfigurations(configurations);
      return configurations;
    },
    [projectId],
  );

  return {
    runConfigurations,
    saveRunConfiguration,
    isHydrated,
  } as const;
}
