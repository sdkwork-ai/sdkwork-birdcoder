import { defineLocaleModule } from '../../../resource.ts';
import { sdkworkSubscriptionCheckoutResources } from '@sdkwork/membership-pc-subscription/i18n';

export default defineLocaleModule('user/token-plan/commerce', {
  ...sdkworkSubscriptionCheckoutResources['zh-CN'],
  user: {
    tokenPlan: {
      commerce: {
        close: '关闭',
        pointsDetails: {
          balanceLabel: '当前算力元',
          description: '查看当前账户可用于模型调用和智能编码任务的算力元余额。',
          hint: '充值或兑换完成后，余额会自动更新。',
          title: '算力元详情',
        },
        pointsRecharge: {
          account: 'BirdCoder',
          agreement: '支付前请阅读并同意《算力元充值服务协议》。',
          agreementAccepted: '您已同意《算力元充值服务协议》。',
          agreementRequired: '请先同意算力元充值服务协议。',
          completed: '支付完成，算力元已到账。',
          confirmPayment: '同意并支付',
          creatingPayment: '正在生成支付二维码...',
          emptyPackages: '暂无可用充值套餐。',
          expired: '订单已过期',
          expiredDescription: '当前充值订单已过期，请重新创建订单后继续支付。',
          expiresIn: '订单剩余支付时间',
          loadFailed: '充值套餐加载失败。',
          loadingPackages: '正在加载充值套餐...',
          myPoints: '我的算力元',
          notice: '算力元不可兑换会员、转赠或提现，充值后的有效期以平台规则为准。',
          paymentUnavailable: '支付暂不可用',
          paymentUnavailableDescription: '暂时无法生成支付二维码，请稍后重试。',
          pointsUnit: '算力元',
          retry: '重新加载',
          retryPayment: '重新支付',
          scanPrompt: '请扫码完成支付',
          title: '购买算力元',
        },
        couponRecharge: {
          codeLabel: '兑换码',
          codePlaceholder: '请输入兑换码',
          dailyQuota: '每日额度',
          description: '输入兑换码，为账户增加算力元或激活限额会员套餐。',
          expiresAt: '有效期至',
          invalidCode: '请输入有效的兑换码。',
          redeem: '立即兑换',
          redeeming: '正在兑换...',
          subscriptionActivated: '会员套餐已激活',
          title: '会员兑换',
          tokenBankCredited: '算力元已到账',
          totalQuota: '总额度',
        },
      },
    },
  },
});
