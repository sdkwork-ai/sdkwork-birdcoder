export interface BirdCoderCommerceInvoiceSummary {
  id: string;
  invoiceNo: string;
  orderId: string;
  userId: string;
  amount: string;
  tax: string;
  status: string;
  issuedAt?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}
