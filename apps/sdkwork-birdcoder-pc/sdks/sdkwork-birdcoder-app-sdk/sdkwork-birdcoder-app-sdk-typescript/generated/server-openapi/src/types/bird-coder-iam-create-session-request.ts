export interface BirdCoderIamCreateSessionRequest {
  account?: string;
  appVersion?: string;
  code?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'android' | 'desktop' | 'ios' | 'web';
  email?: string;
  grantType?: 'password' | 'email_code' | 'phone_code' | 'session_bridge';
  loginMethod?: 'emailCode' | 'password' | 'phoneCode' | 'sessionBridge';
  password?: string;
  phone?: string;
  username?: string;
}
