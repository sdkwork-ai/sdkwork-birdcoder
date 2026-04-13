import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';
import type { IAdminDeploymentService } from '@sdkwork/birdcoder-infrastructure';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadAdminDeployments(
  deploymentService: Pick<IAdminDeploymentService, 'getDeployments'>,
): Promise<BirdCoderDeploymentRecordSummary[]> {
  return deploymentService.getDeployments();
}

export function useAdminDeployments() {
  const { adminDeploymentService } = useIDEServices();
  const [deployments, setDeployments] = useState<BirdCoderDeploymentRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDeployments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadAdminDeployments(adminDeploymentService);
      setDeployments(data);
      return data;
    } catch (error) {
      console.error('Failed to load admin deployments', error);
      setDeployments([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [adminDeploymentService]);

  useEffect(() => {
    void refreshDeployments();
  }, [refreshDeployments]);

  return {
    deployments,
    isLoading,
    refreshDeployments,
  };
}
