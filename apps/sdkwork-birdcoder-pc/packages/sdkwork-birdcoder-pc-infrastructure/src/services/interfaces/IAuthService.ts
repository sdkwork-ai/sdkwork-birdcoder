import type { User } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  hasStoredSession(): Promise<boolean>;
  logout(): Promise<void>;
}
