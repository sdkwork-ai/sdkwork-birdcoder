import type { SdkworkMembershipPlan } from '@sdkwork/membership-pc-membership';
import type { SdkworkSubscriptionCatalogCheckoutPlan } from '@sdkwork/membership-pc-subscription/catalog';

export function resolveMembershipPlanForCatalogCheckout(
  plans: SdkworkMembershipPlan[],
  catalogPlan: SdkworkSubscriptionCatalogCheckoutPlan,
): SdkworkMembershipPlan | null {
  if (plans.length === 0) {
    return null;
  }

  const sortedPlans = [...plans].sort((left, right) => left.packageId - right.packageId);

  if (catalogPlan.membershipTierKey === 'peak') {
    return sortedPlans[sortedPlans.length - 1] ?? null;
  }

  if (catalogPlan.membershipTierKey === 'pro') {
    return sortedPlans[0] ?? null;
  }

  return sortedPlans.find((plan) => plan.id.includes(catalogPlan.id)) ?? sortedPlans[0] ?? null;
}
