export interface BirdCoderCommercePaymentSummary {
  id: string;
  paymentNo: string;
  orderId: string;
  userId: string;
  channel: string;
  channelTransactionId?: string | null;
  amount: string;
  status: string;
  paidAt?: string | null;
  refundAt?: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}
