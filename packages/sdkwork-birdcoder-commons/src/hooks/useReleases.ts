import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext.ts';

export function useReleases() {
  const { releaseService } = useIDEServices();
  const [releases, setReleases] = useState<BirdCoderReleaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshReleases = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await releaseService.getReleases();
      setReleases(data);
    } catch (error) {
      console.error('Failed to load releases', error);
    } finally {
      setIsLoading(false);
    }
  }, [releaseService]);

  useEffect(() => {
    void refreshReleases();
  }, [refreshReleases]);

  return {
    isLoading,
    refreshReleases,
    releases,
  };
}
