import type { BirdCoderIamVerificationPolicySummary } from './bird-coder-iam-verification-policy-summary';

export interface BirdCoderIamRuntimeSettingsSummary {
  leftRailMode: 'auto' | 'highlights-only' | 'qr-only';
  loginMethods: ('emailCode' | 'password' | 'phoneCode' | 'sessionBridge')[];
  oauthLoginEnabled: boolean;
  oauthProviders: string[];
  qrLoginEnabled: boolean;
  qrLoginType: 'web' | 'official' | 'mini';
  recoveryMethods: ('email' | 'phone')[];
  registerMethods: ('email' | 'phone')[];
  verificationPolicy: BirdCoderIamVerificationPolicySummary;
}
