export interface BirdCoderCreateCommerceOrderRequest {
  packageId: string;
  amount: string;
  currency?: string;
  workspaceId?: string;
  metadata?: string;
}
