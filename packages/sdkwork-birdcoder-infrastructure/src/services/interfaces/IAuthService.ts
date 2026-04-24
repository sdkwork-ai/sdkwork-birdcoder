import type {
  SdkworkAuthLoginQrCode,
  SdkworkAuthLoginQrCodeStatusResult,
  SdkworkAuthOAuthAuthorizationInput,
  SdkworkAuthOAuthLoginInput,
} from '@sdkwork/auth-runtime-pc-react';
import type {
  BirdCoderUserCenterEmailCodeLoginRequest,
  BirdCoderUserCenterLoginRequest,
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterPasswordResetChallengeRequest,
  BirdCoderUserCenterPasswordResetRequest,
  BirdCoderUserCenterPhoneCodeLoginRequest,
  BirdCoderUserCenterRegisterRequest,
  BirdCoderUserCenterSendVerifyCodeRequest,
  BirdCoderUserCenterSessionExchangeRequest,
  User,
} from '@sdkwork/birdcoder-types';

export interface IAuthService {
  checkLoginQrCodeStatus?(qrKey: string): Promise<SdkworkAuthLoginQrCodeStatusResult>;
  exchangeUserCenterSession?(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<User>;
  generateLoginQrCode?(): Promise<SdkworkAuthLoginQrCode>;
  getUserCenterConfig?(): Promise<BirdCoderUserCenterMetadataSummary | null>;
  getOAuthAuthorizationUrl?(
    input: SdkworkAuthOAuthAuthorizationInput,
  ): Promise<string>;
  getCurrentUser(): Promise<User | null>;
  login(
    request: BirdCoderUserCenterLoginRequest | string,
    password?: string,
  ): Promise<User>;
  logout(): Promise<void>;
  register(
    request: BirdCoderUserCenterRegisterRequest | string,
    password?: string,
    name?: string,
  ): Promise<User>;
  requestPasswordReset?(
    request: BirdCoderUserCenterPasswordResetChallengeRequest,
  ): Promise<void>;
  resetPassword?(request: BirdCoderUserCenterPasswordResetRequest): Promise<void>;
  sendVerifyCode?(request: BirdCoderUserCenterSendVerifyCodeRequest): Promise<void>;
  signInWithEmailCode?(
    request: BirdCoderUserCenterEmailCodeLoginRequest,
  ): Promise<User>;
  signInWithOAuth?(input: SdkworkAuthOAuthLoginInput): Promise<User>;
  signInWithPhoneCode?(
    request: BirdCoderUserCenterPhoneCodeLoginRequest,
  ): Promise<User>;
}
