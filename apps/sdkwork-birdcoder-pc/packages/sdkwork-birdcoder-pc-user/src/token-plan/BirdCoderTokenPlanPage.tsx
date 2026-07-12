/**
 * BirdCoder Token Plan page.
 *
 * Replaces the legacy `VipPage` (which used `SdkworkMembershipPage` from
 * `@sdkwork/membership-pc-membership`) with the unified Token Plan catalog
 * from `@sdkwork/membership-pc-subscription/catalog`, following the same
 * integration pattern as sdkwork-clawrouter's `ClawRouterTokenPlanPage`.
 *
 * The `SdkworkSubscriptionCatalogPage` provides a rich subscription catalog
 * with plan grid, tier comparison, checkout modal, points purchase, and
 * redeem flows. Custom host components (modals) are styled to match the
 * BirdCoder dark IDE shell, aligned with clawrouter's dark theme.
 */

import { SdkworkSubscriptionCatalogPage } from '@sdkwork/membership-pc-subscription/catalog';
import { BirdCoderTokenPlanCheckoutModal } from './BirdCoderTokenPlanCheckoutModal.tsx';
import {
  BirdCoderTokenPlanPointsDetailsModal,
  BirdCoderTokenPlanPointsPurchaseModal,
  BirdCoderTokenPlanRedeemModal,
} from './BirdCoderTokenPlanCommerceModal.tsx';
import { useTokenPlanMemberSummary } from './tokenPlanMemberSummary.ts';
import { useTokenPlanNotify } from './tokenPlanNotify.tsx';

export interface BirdCoderTokenPlanPageProps {
  className?: string;
}

export function BirdCoderTokenPlanPage({
  className,
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
            checkoutModal: BirdCoderTokenPlanCheckoutModal,
            pointsDetailsModal: BirdCoderTokenPlanPointsDetailsModal,
            pointsPurchaseModal: BirdCoderTokenPlanPointsPurchaseModal,
            redeemModal: BirdCoderTokenPlanRedeemModal,
          }}
          memberSummary={memberSummary}
          notifyOutlet={NotifyOutlet}
          onMembershipTierUpdated={(membershipTierKey, _durationDays) => {
            setMembershipTierKey(membershipTierKey);
            void refreshMembership().catch(() => undefined);
          }}
          onNotify={onNotify}
        />
      </div>
    </div>
  );
}
