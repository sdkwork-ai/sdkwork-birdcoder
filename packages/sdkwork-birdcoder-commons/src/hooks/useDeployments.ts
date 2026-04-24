import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';
import type { IDeploymentService } from '@sdkwork/birdcoder-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadDeployments(
  deploymentService: Pick<IDeploymentService, 'getDeployments'>,
): Promise<BirdCoderDeploymentRecordSummary[]> {
  return deploymentService.getDeployments();
}

export function useDeployments() {
  const { deploymentService } = useIDEServices();
  const [deployments, setDeployments] = useState<BirdCoderDeploymentRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDeployments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadDeployments(deploymentService);
      setDeployments(data);
      return data;
    } catch (error) {
      console.error('Failed to load deployments', error);
      setDeployments([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [deploymentService]);

  useEffect(() => {
    void refreshDeployments();
  }, [refreshDeployments]);

  return {
    deployments,
    isLoading,
    refreshDeployments,
  };
}
