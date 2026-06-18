export interface BirdCoderIamOAuthSessionCreateRequest {
  code: string;
  deviceId?: string;
  deviceType?: 'android' | 'desktop' | 'ios' | 'web';
  provider: string;
  state?: string;
}
