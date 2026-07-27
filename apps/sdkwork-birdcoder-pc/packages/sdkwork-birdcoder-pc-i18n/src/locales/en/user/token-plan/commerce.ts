import { defineLocaleModule } from '../../../resource.ts';
import { sdkworkSubscriptionCheckoutResources } from '@sdkwork/membership-pc-subscription/i18n';

export default defineLocaleModule('user/token-plan/commerce', {
  ...sdkworkSubscriptionCheckoutResources['en-US'],
  user: {
    tokenPlan: {
      commerce: {
        close: 'Close',
        pointsDetails: {
          balanceLabel: 'Current Compute Credits',
          description: 'View the Compute Credits available for model calls and coding tasks.',
          hint: 'Your balance refreshes automatically after a recharge or redemption.',
          title: 'Compute Credits details',
        },
        pointsRecharge: {
          account: 'BirdCoder',
          agreement: 'Review and accept the Compute Credits Recharge Agreement before payment.',
          agreementAccepted: 'You accepted the Compute Credits Recharge Agreement.',
          agreementRequired: 'Accept the Compute Credits Recharge Agreement to continue.',
          completed: 'Payment completed. Compute Credits have been added to your account.',
          confirmPayment: 'Accept and pay',
          creatingPayment: 'Creating payment QR code...',
          emptyPackages: 'No recharge packages are currently available.',
          expired: 'Order expired',
          expiredDescription: 'This recharge order expired. Create a new order to continue.',
          expiresIn: 'Order expires in',
          loadFailed: 'Recharge packages could not be loaded.',
          loadingPackages: 'Loading recharge packages...',
          myPoints: 'My Compute Credits',
          notice: 'Compute Credits cannot be exchanged for membership, transferred, or withdrawn. Platform expiration rules apply.',
          paymentUnavailable: 'Payment unavailable',
          paymentUnavailableDescription: 'A payment QR code cannot be created right now. Try again later.',
          pointsUnit: 'credits',
          retry: 'Reload',
          retryPayment: 'Create new payment',
          scanPrompt: 'Scan to complete payment',
          title: 'Buy Compute Credits',
        },
        couponRecharge: {
          codeLabel: 'Redemption code',
          codePlaceholder: 'Enter a redemption code',
          dailyQuota: 'Daily quota',
          description: 'Redeem a code to add Compute Credits or activate a quota-limited membership plan.',
          expiresAt: 'Valid until',
          invalidCode: 'Enter a valid redemption code.',
          redeem: 'Redeem',
          redeeming: 'Redeeming...',
          subscriptionActivated: 'Membership plan activated',
          title: 'Membership redemption',
          tokenBankCredited: 'Compute Credits added',
          totalQuota: 'Total quota',
        },
      },
    },
  },
});
