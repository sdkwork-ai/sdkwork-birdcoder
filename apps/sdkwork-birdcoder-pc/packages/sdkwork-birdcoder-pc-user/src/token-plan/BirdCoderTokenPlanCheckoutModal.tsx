import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SDKWORK_SUBSCRIPTION_I18N_KEYS,
  type SdkworkSubscriptionCatalogCheckoutModalProps,
} from '@sdkwork/membership-pc-subscription/catalog';
import {
  SdkworkOrderCheckoutDialog,
  type SdkworkOrderCheckoutDialogCopy,
  type SdkworkOrderCheckoutPayment,
} from '@sdkwork/order-pc-checkout';

function createCheckoutCopy(
  translate: (key: string) => string,
): SdkworkOrderCheckoutDialogCopy {
  const keys = SDKWORK_SUBSCRIPTION_I18N_KEYS.checkout;
  return {
    activationDescription: translate(keys.activationDescription),
    activationTitle: translate(keys.activationTitle),
    close: translate(keys.close),
    completed: translate(keys.completed),
    creatingPayment: translate(keys.creatingPayment),
    paymentUnavailable: translate(keys.paymentUnavailableTitle),
    paymentUnavailableDescription: translate(keys.paymentUnavailableDescription),
    payByQr: translate(keys.payByQr),
    price: translate(keys.price),
    retry: translate(keys.retry),
    scanPrompt: translate(keys.scanPrompt),
    secureDescription: translate(keys.secureDescription),
    secureTitle: translate(keys.secureTitle),
    selectedItem: translate(keys.selectedPlan),
  };
}

export function BirdCoderTokenPlanCheckoutModal({
  isOpen,
  onClose,
  onPaymentCompleted,
  onPaymentStatus,
  onPurchase,
  plan,
}: SdkworkSubscriptionCatalogCheckoutModalProps) {
  const { t } = useTranslation();
  const copy = useMemo(() => createCheckoutCopy((key) => t(key)), [t]);
  const driver = useMemo(() => ({
    createPayment: onPurchase,
    getPaymentStatus: onPaymentStatus
      ? async (payment: SdkworkOrderCheckoutPayment) => {
          if (!payment.orderId) {
            return { ...payment, status: 'failed' as const };
          }
          return onPaymentStatus(payment.orderId);
        }
      : undefined,
    onPaymentCompleted,
  }), [onPaymentCompleted, onPaymentStatus, onPurchase]);

  return (
    <SdkworkOrderCheckoutDialog
      copy={copy}
      driver={driver}
      isOpen={isOpen}
      onClose={onClose}
      summary={plan ? {
        id: plan.id,
        name: plan.name,
        originalPriceLabel: plan.originalPrice,
        periodLabel: plan.packagePeriodLabel,
        priceLabel: plan.priceLabel,
      } : null}
    />
  );
}
