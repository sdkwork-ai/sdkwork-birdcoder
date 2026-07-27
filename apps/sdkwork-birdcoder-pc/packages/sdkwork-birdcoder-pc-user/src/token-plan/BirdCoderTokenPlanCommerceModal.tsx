import { useEffect } from 'react';
import { Sparkles, Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSdkworkMembershipController } from '@sdkwork/membership-pc-membership';
import type { SdkworkSubscriptionCatalogModalProps } from '@sdkwork/membership-pc-subscription/catalog';
import {
  SdkworkCouponRedemptionDialog,
  SdkworkPointsRechargeDialog,
} from '@sdkwork/order-pc-recharge';
import { Button } from '@sdkwork/ui-pc-react';
import {
  getBirdCoderCouponRechargeService,
  getBirdCoderPointsRechargeService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/membershipSdkBootstrap';

const COPY_PREFIX = 'user.tokenPlan.commerce';

export function BirdCoderTokenPlanPointsPurchaseModal({
  currentPoints,
  isOpen,
  onClose,
}: SdkworkSubscriptionCatalogModalProps) {
  const { t } = useTranslation();
  const membershipController = useSdkworkMembershipController();

  return (
    <SdkworkPointsRechargeDialog
      copy={{
        account: t(`${COPY_PREFIX}.pointsRecharge.account`),
        agreement: t(`${COPY_PREFIX}.pointsRecharge.agreement`),
        agreementAccepted: t(`${COPY_PREFIX}.pointsRecharge.agreementAccepted`),
        agreementRequired: t(`${COPY_PREFIX}.pointsRecharge.agreementRequired`),
        close: t(`${COPY_PREFIX}.close`),
        completed: t(`${COPY_PREFIX}.pointsRecharge.completed`),
        confirmPayment: t(`${COPY_PREFIX}.pointsRecharge.confirmPayment`),
        creatingPayment: t(`${COPY_PREFIX}.pointsRecharge.creatingPayment`),
        emptyPackages: t(`${COPY_PREFIX}.pointsRecharge.emptyPackages`),
        expired: t(`${COPY_PREFIX}.pointsRecharge.expired`),
        expiredDescription: t(`${COPY_PREFIX}.pointsRecharge.expiredDescription`),
        expiresIn: t(`${COPY_PREFIX}.pointsRecharge.expiresIn`),
        loadFailed: t(`${COPY_PREFIX}.pointsRecharge.loadFailed`),
        loadingPackages: t(`${COPY_PREFIX}.pointsRecharge.loadingPackages`),
        myPoints: t(`${COPY_PREFIX}.pointsRecharge.myPoints`),
        notice: t(`${COPY_PREFIX}.pointsRecharge.notice`),
        paymentUnavailable: t(`${COPY_PREFIX}.pointsRecharge.paymentUnavailable`),
        paymentUnavailableDescription: t(
          `${COPY_PREFIX}.pointsRecharge.paymentUnavailableDescription`,
        ),
        pointsUnit: t(`${COPY_PREFIX}.pointsRecharge.pointsUnit`),
        retry: t(`${COPY_PREFIX}.pointsRecharge.retry`),
        retryPayment: t(`${COPY_PREFIX}.pointsRecharge.retryPayment`),
        scanPrompt: t(`${COPY_PREFIX}.pointsRecharge.scanPrompt`),
        title: t(`${COPY_PREFIX}.pointsRecharge.title`),
      }}
      currentPoints={currentPoints}
      isOpen={isOpen}
      onClose={onClose}
      onCompleted={async () => {
        await membershipController.refresh();
      }}
      service={getBirdCoderPointsRechargeService()}
    />
  );
}

export function BirdCoderTokenPlanRedeemModal({
  isOpen,
  onClose,
}: SdkworkSubscriptionCatalogModalProps) {
  const { t } = useTranslation();
  const membershipController = useSdkworkMembershipController();

  return (
    <SdkworkCouponRedemptionDialog
      copy={{
        close: t(`${COPY_PREFIX}.close`),
        codeLabel: t(`${COPY_PREFIX}.couponRecharge.codeLabel`),
        codePlaceholder: t(`${COPY_PREFIX}.couponRecharge.codePlaceholder`),
        dailyQuota: t(`${COPY_PREFIX}.couponRecharge.dailyQuota`),
        description: t(`${COPY_PREFIX}.couponRecharge.description`),
        expiresAt: t(`${COPY_PREFIX}.couponRecharge.expiresAt`),
        invalidCode: t(`${COPY_PREFIX}.couponRecharge.invalidCode`),
        redeem: t(`${COPY_PREFIX}.couponRecharge.redeem`),
        redeeming: t(`${COPY_PREFIX}.couponRecharge.redeeming`),
        subscriptionActivated: t(`${COPY_PREFIX}.couponRecharge.subscriptionActivated`),
        title: t(`${COPY_PREFIX}.couponRecharge.title`),
        tokenBankCredited: t(`${COPY_PREFIX}.couponRecharge.tokenBankCredited`),
        totalQuota: t(`${COPY_PREFIX}.couponRecharge.totalQuota`),
      }}
      isOpen={isOpen}
      onClose={onClose}
      onCompleted={async () => {
        await membershipController.refresh();
      }}
      service={getBirdCoderCouponRechargeService()}
    />
  );
}

export function BirdCoderTokenPlanPointsDetailsModal({
  currentPoints,
  isOpen,
  onClose,
}: SdkworkSubscriptionCatalogModalProps) {
  const { i18n, t } = useTranslation();

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

  if (!isOpen) {
    return null;
  }

  const formattedPoints = currentPoints === null || currentPoints === undefined
    ? '--'
    : new Intl.NumberFormat(i18n.language).format(currentPoints);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label={t(`${COPY_PREFIX}.close`)}
        className="token-plan-overlay absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div
        aria-modal="true"
        className="token-plan-dialog relative w-full max-w-md overflow-hidden rounded-lg border border-zinc-800/60 bg-[#1e1e22] shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700/70 bg-zinc-900/80">
              <Wallet aria-hidden="true" className="h-5 w-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase text-zinc-500">BirdCoder</div>
              <h2 className="text-lg font-semibold text-white">
                {t(`${COPY_PREFIX}.pointsDetails.title`)}
              </h2>
            </div>
          </div>
          <button
            aria-label={t(`${COPY_PREFIX}.close`)}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-7 text-zinc-300">
            {t(`${COPY_PREFIX}.pointsDetails.description`)}
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-4 py-4">
            <span className="text-sm text-zinc-400">
              {t(`${COPY_PREFIX}.pointsDetails.balanceLabel`)}
            </span>
            <strong className="text-xl font-semibold text-white">{formattedPoints}</strong>
          </div>
          <div className="flex items-start gap-2 text-sm leading-6 text-zinc-400">
            <Sparkles aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-sky-400" />
            <span>{t(`${COPY_PREFIX}.pointsDetails.hint`)}</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} type="button" variant="secondary">
              {t(`${COPY_PREFIX}.close`)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
