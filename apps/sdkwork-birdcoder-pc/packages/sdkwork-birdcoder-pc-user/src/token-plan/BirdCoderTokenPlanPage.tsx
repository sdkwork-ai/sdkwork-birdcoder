/**
 * BirdCoder Token Plan page.
 *
 * Replaces the legacy `VipPage` (which used `SdkworkMembershipPage` from
 * `@sdkwork/membership-pc-membership`) with the unified Token Plan catalog
 * from `@sdkwork/membership-pc-subscription/catalog`.
 *
 * The `SdkworkSubscriptionCatalogPage` owns the subscription catalog and its
 * checkout payment state. BirdCoder supplies only non-payment host modals
 * that are specific to the IDE shell.
 */

import {
  SdkworkSubscriptionCatalogPage,
  sdkworkSubscriptionCatalogHostComponents,
} from '@sdkwork/membership-pc-subscription/catalog';
import {
  BirdCoderTokenPlanPointsDetailsModal,
  BirdCoderTokenPlanPointsPurchaseModal,
  BirdCoderTokenPlanRedeemModal,
} from './BirdCoderTokenPlanCommerceModal.tsx';
import { useTokenPlanMemberSummary } from './tokenPlanMemberSummary.ts';
import { useTokenPlanNotify } from './tokenPlanNotify.tsx';

export interface BirdCoderTokenPlanPageProps {
  className?: string;
  onAuthenticationRequired?: () => void;
}

export function BirdCoderTokenPlanPage({
  className,
  onAuthenticationRequired,
}: BirdCoderTokenPlanPageProps = {}) {
  const { memberSummary, refreshMembership, setMembershipTierKey } = useTokenPlanMemberSummary();
  const { NotifyOutlet, onNotify } = useTokenPlanNotify();

  const wrapperClass = ['flex-1 min-h-0 overflow-y-auto bg-[#0e0e11]', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      <div className="mx-auto w-full max-w-7xl">
        <SdkworkSubscriptionCatalogPage
          components={{
            ...sdkworkSubscriptionCatalogHostComponents,
            pointsDetailsModal: BirdCoderTokenPlanPointsDetailsModal,
            pointsPurchaseModal: BirdCoderTokenPlanPointsPurchaseModal,
            redeemModal: BirdCoderTokenPlanRedeemModal,
          }}
          memberSummary={memberSummary}
          notifyOutlet={NotifyOutlet}
          onLoginRequired={onAuthenticationRequired}
          onMembershipTierUpdated={(membershipTierKey: string) => {
            setMembershipTierKey(membershipTierKey);
            void refreshMembership().catch(() => undefined);
          }}
          onNotify={onNotify}
        />
      </div>
    </div>
  );
}
