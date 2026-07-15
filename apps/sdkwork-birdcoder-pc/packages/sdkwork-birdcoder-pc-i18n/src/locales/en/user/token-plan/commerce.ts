import { defineLocaleModule } from '../../../resource.ts';
import { sdkworkSubscriptionCheckoutResources } from '@sdkwork/membership-pc-subscription/i18n';

export default defineLocaleModule('user/token-plan/commerce', {
  ...sdkworkSubscriptionCheckoutResources['en-US'],
  user: {
    tokenPlan: {
      commerce: {
        cancel: 'Cancel',
        close: 'Close',
        walletHint: 'Use the button below to complete this action.',
      },
    },
  },
});
