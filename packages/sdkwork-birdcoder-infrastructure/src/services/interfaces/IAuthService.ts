import type { User } from '@sdkwork/birdcoder-types';

export interface IAuthService {
  login(email: string, password?: string): Promise<User>;
  register(email: string, password?: string, name?: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
