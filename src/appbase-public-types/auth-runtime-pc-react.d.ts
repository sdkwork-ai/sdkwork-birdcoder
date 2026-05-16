export interface SdkworkAuthRuntimeUser {
  avatarUrl?: string;
  displayName: string;
  email: string;
  firstName: string;
  id?: string;
  initials: string;
  lastName: string;
  username?: string;
}

export interface SdkworkAuthRuntimeSession {
  accessToken: string;
  authToken: string;
  refreshToken?: string;
  user?: SdkworkAuthRuntimeUser;
}

export interface SdkworkAuthLoginQrCode {
  description?: string;
  expireTime?: number;
  qrContent?: string;
  qrKey: string;
  qrUrl?: string;
  title?: string;
  type?: string;
}

export type SdkworkAuthLoginQrCodeStatus =
  | "confirmed"
  | "expired"
  | "pending"
  | "scanned";

export interface SdkworkAuthLoginQrCodeStatusResult {
  session?: SdkworkAuthRuntimeSession;
  status: SdkworkAuthLoginQrCodeStatus;
  user?: SdkworkAuthRuntimeUser;
}

export interface SdkworkAuthOAuthAuthorizationInput {
  provider: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export type SdkworkAuthOAuthDeviceType =
  | "android"
  | "desktop"
  | "ios"
  | "web";

export type SdkworkAuthVerifyType = "EMAIL" | "PHONE";
export type SdkworkAuthScene = "LOGIN" | "REGISTER" | "RESET_PASSWORD";
export type SdkworkAuthPasswordResetChannel = "EMAIL" | "SMS";

export interface SdkworkAuthOAuthLoginInput {
  code: string;
  deviceId?: string;
  deviceType?: SdkworkAuthOAuthDeviceType;
  provider: string;
  state?: string;
}

export interface SdkworkCanonicalAuthLoginRequest {
  account?: string;
  email?: string;
  password?: string;
}

export interface SdkworkCanonicalAuthRegisterRequest {
  channel?: SdkworkAuthVerifyType;
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  username?: string;
  verificationCode?: string;
}

export interface SdkworkCanonicalAuthSendVerifyCodeRequest {
  scene: SdkworkAuthScene;
  target: string;
  verifyType: SdkworkAuthVerifyType;
}

export interface SdkworkCanonicalAuthEmailCodeLoginRequest {
  appVersion?: string;
  code: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: SdkworkAuthOAuthDeviceType;
  email: string;
}

export interface SdkworkCanonicalAuthPhoneCodeLoginRequest {
  appVersion?: string;
  code: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: SdkworkAuthOAuthDeviceType;
  phone: string;
}

export interface SdkworkCanonicalAuthPasswordResetChallengeRequest {
  account: string;
  channel: SdkworkAuthPasswordResetChannel;
}

export interface SdkworkCanonicalAuthPasswordResetRequest {
  account: string;
  code: string;
  confirmPassword?: string;
  newPassword: string;
}

export interface SdkworkCanonicalAuthSessionExchangeRequest {
  avatarUrl?: string;
  email: string;
  name?: string;
  providerKey?: string;
  subject?: string;
  userId?: string;
}

export interface SdkworkCanonicalRuntimeAuthRetryOptions {
  shouldRetry?: (error: unknown) => boolean;
}

export interface SdkworkCanonicalRuntimeAuthAuthorityServiceOptions<
  TUser,
  TConfig,
  TSession,
  TProfile,
> {
  clearSessionToken(): void;
  createUnavailableError(): Error;
  exchangeSession?(
    request: SdkworkCanonicalAuthSessionExchangeRequest,
  ): Promise<TSession>;
  execute?<TResult>(
    task: () => Promise<TResult>,
    retryOptions?: SdkworkCanonicalRuntimeAuthRetryOptions,
  ): Promise<TResult>;
  getConfig?(): Promise<TConfig | null>;
  getProfile?(): Promise<TProfile | null>;
  isRouteUnavailable?(error: unknown): boolean;
  isSessionRejected?(error: unknown): boolean;
  isTransientError?(error: unknown): boolean;
  login(request: SdkworkCanonicalAuthLoginRequest): Promise<TSession>;
  logout?(): Promise<void>;
  logoutSession?(): Promise<void>;
  mapProfileUser(profile: TProfile): TUser;
  mapSessionUser(session: TSession): TUser;
  readSessionToken(): string | null;
  register(request: SdkworkCanonicalAuthRegisterRequest): Promise<TSession>;
  requestPasswordReset?(
    request: SdkworkCanonicalAuthPasswordResetChallengeRequest,
  ): Promise<void>;
  resolveSessionToken?(session: TSession): string | null | undefined;
  resetPassword?(request: SdkworkCanonicalAuthPasswordResetRequest): Promise<void>;
  sendVerifyCode?(request: SdkworkCanonicalAuthSendVerifyCodeRequest): Promise<void>;
  signInWithEmailCode?(
    request: SdkworkCanonicalAuthEmailCodeLoginRequest,
  ): Promise<TSession>;
  signInWithPhoneCode?(
    request: SdkworkCanonicalAuthPhoneCodeLoginRequest,
  ): Promise<TSession>;
  supportsLocalCredentials?(metadata: TConfig | null): boolean;
  writeSessionToken(token: string): string;
}

export declare function createSdkworkCanonicalRuntimeAuthAuthorityService<
  TUser,
  TConfig,
  TSession,
  TProfile,
>(
  options: SdkworkCanonicalRuntimeAuthAuthorityServiceOptions<
    TUser,
    TConfig,
    TSession,
    TProfile
  >,
): unknown;
