import type { User } from '@sdkwork/birdcoder-types';

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  logout(): Promise<void>;
}
