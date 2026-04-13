import {
  BIRDCODER_APPBASE_AUTH_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
  type User,
} from '@sdkwork/birdcoder-types';
import { createJsonRecordRepository } from '../../storage/dataKernel.ts';
import type { IAuthService } from '../interfaces/IAuthService.ts';

const authSessionRepository = createJsonRecordRepository<User | null>({
  binding: BIRDCODER_APPBASE_AUTH_STORAGE_BINDING,
  definition: getBirdCoderEntityDefinition('identity'),
  fallback: null,
  normalize(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<User>;
    if (!candidate.id || !candidate.email || !candidate.name) {
      return null;
    }

    return {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      avatarUrl: candidate.avatarUrl,
    };
  },
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class MockAuthService implements IAuthService {
  private currentUser: User | null = null;
  private hydratePromise: Promise<void> | null = null;
  private hydrated = false;

  private async hydrateFromStorage(): Promise<void> {
    if (this.hydrated) {
      return;
    }

    if (!this.hydratePromise) {
      this.hydratePromise = (async () => {
        this.currentUser = await authSessionRepository.read();
        this.hydrated = true;
      })();
    }

    await this.hydratePromise;
  }

  async login(email: string, password?: string): Promise<User> {
    void password;
    await this.hydrateFromStorage();
    await delay(500);
    this.currentUser = {
      id: 'u1',
      name: email.split('@')[0] || 'Test User',
      email,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    };
    await authSessionRepository.write(this.currentUser);
    return this.currentUser;
  }

  async register(email: string, password?: string, name?: string): Promise<User> {
    void password;
    await this.hydrateFromStorage();
    await delay(500);
    this.currentUser = {
      id: `u${Date.now()}`,
      name: name || email.split('@')[0] || 'New User',
      email,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
    };
    await authSessionRepository.write(this.currentUser);
    return this.currentUser;
  }

  async logout(): Promise<void> {
    await this.hydrateFromStorage();
    await delay(200);
    this.currentUser = null;
    await authSessionRepository.clear();
  }

  async getCurrentUser(): Promise<User | null> {
    await this.hydrateFromStorage();
    await delay(100);
    return this.currentUser;
  }
}
