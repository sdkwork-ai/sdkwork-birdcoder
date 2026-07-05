export interface BirdCoderCreateCommercePaymentRequest {
  orderId: string;
  channel: string;
  amount?: string;
  channelTransactionId?: string;
  metadata?: string;
}
