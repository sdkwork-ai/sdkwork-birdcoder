export interface BirdCoderCommerceOrderSummary {
  id: string;
  workspaceId?: string | null;
  orderNo: string;
  userId: string;
  packageId: string;
  amount: string;
  currency: string;
  status: string;
  paidAt?: string | null;
  refundAt?: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}
