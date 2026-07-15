import { defineLocaleModule } from '../../../resource.ts';
import { sdkworkSubscriptionCheckoutResources } from '@sdkwork/membership-pc-subscription/catalog';

export default defineLocaleModule('user/token-plan/commerce', {
  ...sdkworkSubscriptionCheckoutResources['zh-CN'],
  user: {
    tokenPlan: {
      commerce: {
        cancel: '取消',
        close: '关闭',
        walletHint: '点击下方按钮将直接完成操作。',
      },
    },
  },
});
