export interface BirdCoderIamQrAuthSessionSummary {
  expiresAt?: string;
  qrContent?: string;
  qrUrl?: string;
  sessionKey: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
}
