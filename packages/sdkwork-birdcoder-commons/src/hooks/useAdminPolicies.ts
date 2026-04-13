import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderAdminPolicySummary } from '@sdkwork/birdcoder-types';
import type { IAdminPolicyService } from '@sdkwork/birdcoder-infrastructure';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadAdminPolicies(
  policyService: Pick<IAdminPolicyService, 'getPolicies'>,
): Promise<BirdCoderAdminPolicySummary[]> {
  return policyService.getPolicies();
}

export function useAdminPolicies() {
  const { adminPolicyService } = useIDEServices();
  const [policies, setPolicies] = useState<BirdCoderAdminPolicySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadAdminPolicies(adminPolicyService);
      setPolicies(data);
      return data;
    } catch (error) {
      console.error('Failed to load admin policies', error);
      setPolicies([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [adminPolicyService]);

  useEffect(() => {
    void refreshPolicies();
  }, [refreshPolicies]);

  return {
    policies,
    isLoading,
    refreshPolicies,
  };
}
