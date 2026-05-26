import {
  clearStoredAppSessionToken,
  storeAppSessionFromResult,
  type StoredAppSessionToken,
} from './appSessionToken.ts';
import { resetBirdCoderIamRuntime } from './iamRuntime.ts';
import {
  getBirdCoderGeneratedAppSdkClient,
  resetBirdCoderSdkClients,
  type BirdCoderGeneratedAppSdkClientOptions,
} from './sdkClients.ts';

export async function createAppSession(
  options: BirdCoderGeneratedAppSdkClientOptions = {},
): Promise<StoredAppSessionToken> {
  const result = await getBirdCoderGeneratedAppSdkClient(options).auth.sessions.create({
    grantType: 'session_bridge',
  });
  const stored = storeAppSessionFromResult(result);
  resetBirdCoderSdkClients();
  resetBirdCoderIamRuntime();
  return stored;
}

export function clearAppSession(): void {
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
  resetBirdCoderIamRuntime();
}

export async function revokeAppSession(): Promise<void> {
  try {
    await getBirdCoderGeneratedAppSdkClient().auth.sessions.current.delete();
  } catch {
    // Logout must always clear local state, even when the server session is already gone.
  } finally {
    clearAppSession();
  }
}
