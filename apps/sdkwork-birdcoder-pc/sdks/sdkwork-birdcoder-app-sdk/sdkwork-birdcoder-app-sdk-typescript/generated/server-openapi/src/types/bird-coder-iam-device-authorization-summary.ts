export interface BirdCoderIamDeviceAuthorizationSummary {
  deviceAuthorizationId: string;
  expiresAt?: string;
  qrContent?: string;
  qrUrl?: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
}
