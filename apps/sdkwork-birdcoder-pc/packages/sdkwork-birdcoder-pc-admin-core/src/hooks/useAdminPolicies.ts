import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAdminPolicyService } from '../services/interfaces/IAdminPolicyService.ts';

export async function loadAdminPolicies(
  policyService: Pick<IAdminPolicyService, 'getPolicies'>,
): Promise<BirdCoderIamPolicySummary[]> {
  return policyService.getPolicies();
}

export function useAdminPolicies(
  adminPolicyService: IAdminPolicyService,
) {
  const [policies, setPolicies] = useState<BirdCoderIamPolicySummary[]>([]);
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
