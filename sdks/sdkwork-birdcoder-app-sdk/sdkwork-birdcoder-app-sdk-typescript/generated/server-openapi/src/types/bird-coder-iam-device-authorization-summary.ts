export interface BirdCoderIamDeviceAuthorizationSummary {
  deviceAuthorizationId: string;
  expiresAt?: string;
  pollSecret?: string;
  qrContent?: string;
  qrUrl?: string;
  sessionReady?: boolean;
  status: 'pending' | 'scanned' | 'confirmed' | 'completed' | 'expired' | 'cancelled' | 'failed';
}
