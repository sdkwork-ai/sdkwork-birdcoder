import {
  clearBirdcoderIamRuntimeSession,
  getBirdcoderIamRuntime,
  resetBirdcoderIamRuntime,
  resetBirdcoderAuthenticatedSdkClients,
} from './appAuthRuntime.ts';
import {
  clearAppSdkSessionTokens,
  isAppSdkSessionAuthenticated,
  readAppSdkSessionTokens,
  type BirdCoderSession,
} from './session.ts';

export interface AppAuthService {
  getCurrentSession(): Promise<BirdCoderSession | null>;
  logout(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRuntime = any;

export const appAuthService: AppAuthService = {
  async getCurrentSession() {
    const storedSession = readAppSdkSessionTokens();
    if (!isAppSdkSessionAuthenticated(storedSession)) {
      clearBirdcoderIamRuntimeSession();
      return null;
    }

    try {
      const runtime = getBirdcoderIamRuntime() as AnyRuntime;
      const session = await runtime.service.auth.sessions.current.retrieve();
      return session as BirdCoderSession;
    } catch {
      clearBirdcoderIamRuntimeSession();
      resetBirdcoderIamRuntime();
      return null;
    }
  },

  async logout() {
    try {
      const runtime = getBirdcoderIamRuntime() as AnyRuntime;
      await runtime.service.auth.sessions.current.delete();
    } finally {
      clearAppSdkSessionTokens();
      resetBirdcoderAuthenticatedSdkClients();
      resetBirdcoderIamRuntime();
    }
  },
};
