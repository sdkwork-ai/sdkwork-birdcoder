export interface BirdCoderIamDeviceAuthorizationSummary {
  expiresAt?: string;
  qrContent?: string;
  qrUrl?: string;
  deviceAuthorizationId: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
}
