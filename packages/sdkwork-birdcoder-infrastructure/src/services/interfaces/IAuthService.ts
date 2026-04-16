import type {
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterSessionExchangeRequest,
  User,
} from '@sdkwork/birdcoder-types';

export interface IAuthService {
  exchangeUserCenterSession?(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<User>;
  getUserCenterConfig?(): Promise<BirdCoderUserCenterMetadataSummary | null>;
  getCurrentUser(): Promise<User | null>;
  login(email: string, password?: string): Promise<User>;
  logout(): Promise<void>;
  register(email: string, password?: string, name?: string): Promise<User>;
}
