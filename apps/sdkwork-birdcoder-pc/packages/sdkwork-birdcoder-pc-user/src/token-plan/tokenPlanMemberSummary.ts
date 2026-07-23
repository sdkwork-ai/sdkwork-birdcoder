/**
 * BirdCoder Token Plan member summary hook.
 *
 * The BirdCoder global TokenManager is wired into the membership SDK via
 * `bootstrapBirdCoderMembershipSdk()` during shell bootstrap, so the
 * membership controller can consume the same IAM session tokens.
 */

import { useEffect, useMemo, useState } from 'react';
import { hasSdkworkMembershipSession } from '@sdkwork/membership-service';
import {
  useSdkworkMembershipController,
  useSdkworkMembershipControllerState,
  type SdkworkMembershipSummary,
} from '@sdkwork/membership-pc-membership';

export function resolveMembershipTierKeyFromSummary(summary: SdkworkMembershipSummary): string {
  if (!summary.isAuthenticated || summary.status === 'guest' || !summary.isMember) {
    return 'none';
  }

  if (summary.currentLevelValue !== null && summary.currentLevelValue >= 2) {
    return 'peak';
  }

  return 'pro';
}

export function useTokenPlanMemberSummary() {
  const controller = useSdkworkMembershipController();
  const state = useSdkworkMembershipControllerState(controller);
  const [tierOverride, setTierOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSdkworkMembershipSession()) {
      return;
    }

    if (!state.isBootstrapped && !state.isLoading && !state.lastError) {
      void controller.bootstrap().catch(() => undefined);
    }
  }, [controller, state.isBootstrapped, state.isLoading, state.lastError]);

  useEffect(() => {
    function handleWindowFocus() {
      if (!hasSdkworkMembershipSession()) {
        return;
      }

      void controller.refresh().catch(() => undefined);
    }

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [controller]);

  const memberSummary = useMemo(() => {
    if (!hasSdkworkMembershipSession()) {
      return null;
    }

    const membershipTierKey =
      tierOverride ?? resolveMembershipTierKeyFromSummary(state.dashboard.summary);
    return { membershipTierKey };
  }, [state.dashboard.summary, tierOverride]);

  return {
    memberSummary,
    setMembershipTierKey: setTierOverride,
    refreshMembership: () => controller.refresh(),
  };
}
