import { useEffect } from 'react';
import { Crown, Sparkles, Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/ui-pc-react';
import type { SdkworkSubscriptionCatalogModalProps } from '@sdkwork/membership-pc-subscription/catalog';

type TokenPlanCommerceModalVariant = 'points-details' | 'points-purchase' | 'redeem';

interface BirdCoderTokenPlanCommerceModalProps extends SdkworkSubscriptionCatalogModalProps {
  variant: TokenPlanCommerceModalVariant;
}

const VARIANT_COPY: Record<
  TokenPlanCommerceModalVariant,
  {
    ctaKey: string;
    ctaDefault: string;
    descriptionKey: string;
    descriptionDefault: string;
    titleKey: string;
    titleDefault: string;
  }
> = {
  'points-details': {
    ctaKey: 'token_plan_open_wallet',
    ctaDefault: '查看积分明细',
    descriptionKey: 'token_plan_points_details_description',
    descriptionDefault: '查看算力积分余额、充值记录与消费明细。',
    titleKey: 'token_plan_points_details_title',
    titleDefault: '积分明细',
  },
  'points-purchase': {
    ctaKey: 'token_plan_open_wallet_recharge',
    ctaDefault: '前往充值',
    descriptionKey: 'token_plan_points_purchase_description',
    descriptionDefault: '选择充值档位或自定义积分数量，支持微信、支付宝等方式。',
    titleKey: 'token_plan_points_purchase_title',
    titleDefault: '购买算力积分',
  },
  redeem: {
    ctaKey: 'token_plan_open_wallet_redeem',
    ctaDefault: '前往兑换',
    descriptionKey: 'token_plan_redeem_description',
    descriptionDefault: '使用兑换码激活会员或领取积分奖励。',
    titleKey: 'token_plan_redeem_title',
    titleDefault: '会员兑换',
  },
};

export function createTokenPlanCommerceModal(variant: TokenPlanCommerceModalVariant) {
  return function TokenPlanCommerceModal(props: SdkworkSubscriptionCatalogModalProps) {
    return <BirdCoderTokenPlanCommerceModal {...props} variant={variant} />;
  };
}

export const BirdCoderTokenPlanPointsPurchaseModal = createTokenPlanCommerceModal('points-purchase');
export const BirdCoderTokenPlanPointsDetailsModal = createTokenPlanCommerceModal('points-details');
export const BirdCoderTokenPlanRedeemModal = createTokenPlanCommerceModal('redeem');

function BirdCoderTokenPlanCommerceModal({
  isOpen,
  onClose,
  variant,
}: BirdCoderTokenPlanCommerceModalProps) {
  const { t } = useTranslation();
  const copy = VARIANT_COPY[variant];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  function handleContinue() {
    onClose();
  }

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            aria-label={t('user.tokenPlan.commerce.close')}
            className="token-plan-overlay absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            type="button"
          />

          <div
            className="token-plan-dialog relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-800/60 bg-[#1e1e22] shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/70 bg-zinc-900/80">
                  {variant === 'redeem' ? (
                    <Crown aria-hidden="true" className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Wallet aria-hidden="true" className="h-5 w-5 text-sky-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    BirdCoder
                  </div>
                  <h2 className="text-lg font-semibold text-white">{t(copy.titleKey, copy.titleDefault)}</h2>
                </div>
              </div>
              <button
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <p className="text-sm leading-7 text-zinc-300">{t(copy.descriptionKey, copy.descriptionDefault)}</p>

              <div className="flex items-center gap-2 rounded-2xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">
                <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-400" />
                <span>{t('user.tokenPlan.commerce.walletHint')}</span>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button onClick={onClose} type="button" variant="ghost">
                  {t('user.tokenPlan.commerce.cancel')}
                </Button>
                <Button onClick={handleContinue} type="button" variant="secondary">
                  {t(copy.ctaKey, copy.ctaDefault)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
