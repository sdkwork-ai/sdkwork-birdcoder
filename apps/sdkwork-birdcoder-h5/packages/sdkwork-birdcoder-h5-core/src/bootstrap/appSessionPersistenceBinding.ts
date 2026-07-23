import { getBirdCoderGlobalTokenManager } from './tokenManager.ts';
import { readBirdCoderSessionRecord } from '../session/birdCoderSessionStorage.ts';

export async function hydrateBirdCoderH5AppSessionPersistence(): Promise<void> {
  const session = await readBirdCoderSessionRecord();
  const tokenManager = getBirdCoderGlobalTokenManager();
  if (!session) {
    tokenManager.clearTokens();
    return;
  }
  tokenManager.setTokens({
    accessToken: session.accessToken,
    authToken: session.authToken,
    expiresAt:
      typeof session.expiresAt === 'number'
        ? session.expiresAt
        : session.expiresAt
          ? Date.parse(session.expiresAt)
          : undefined,
    refreshToken: session.refreshToken,
  });
}
