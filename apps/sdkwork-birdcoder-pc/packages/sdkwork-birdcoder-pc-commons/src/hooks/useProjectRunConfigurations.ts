import { useCallback, useEffect, useState } from 'react';

import {
  getDefaultRunConfigurations,
  type RunConfigurationRecord,
} from '../terminal/runConfigDefinitions.ts';

export function useProjectRunConfigurations(projectId: string | null | undefined) {
  const [runConfigurations, setRunConfigurations] = useState<RunConfigurationRecord[]>(
    getDefaultRunConfigurations(),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsHydrated(false);

    void import('../terminal/runConfigStorage.ts')
      .then(({ ensureStoredRunConfigurations }) => ensureStoredRunConfigurations(projectId))
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
      const { upsertStoredRunConfiguration } = await import('../terminal/runConfigStorage.ts');
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
