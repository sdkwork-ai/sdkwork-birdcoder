import type { User } from '@sdkwork/birdcoder-pc-types';

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  hasStoredSession(): Promise<boolean>;
  logout(): Promise<void>;
}
