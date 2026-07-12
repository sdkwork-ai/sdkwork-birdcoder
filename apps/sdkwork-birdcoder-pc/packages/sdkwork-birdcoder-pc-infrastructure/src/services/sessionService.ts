import type { IamRuntime } from '@sdkwork/iam-runtime';
import {
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
  type StoredAppSessionToken,
} from './appSessionToken.ts';
import {
  getBirdCoderIamRuntime,
} from './iamRuntime.ts';
import { retrieveBirdCoderCurrentSession, invalidateBirdCoderCurrentSession } from './iamCurrentSession.ts';
import { invalidateBirdCoderCurrentUser } from './iamCurrentUser.ts';
import {
  getBirdCoderGlobalTokenManager,
  resetBirdCoderSdkClients,
} from './sdkClients.ts';

export interface CreateAppSessionOptions {
  getRuntime?: () => IamRuntime;
  sessionBridge?: Record<string, unknown>;
}

export interface RevokeAppSessionOptions {
  getRuntime?: () => IamRuntime;
}

export async function createAppSession(
  options: CreateAppSessionOptions = {},
): Promise<StoredAppSessionToken | null> {
  const runtime = options.getRuntime?.() ?? getBirdCoderIamRuntime();
  const result = await retrieveBirdCoderCurrentSession(runtime);
  if (!result) {
    return null;
  }
  const stored = storeAppSessionFromResult(result, {
    preserveSessionMetadata: true,
  });
  resetBirdCoderSdkClients();
  return stored;
}

export function getCurrentAppSession(): StoredAppSessionToken | null {
  return loadStoredAppSessionToken();
}

export function clearAppSession(): void {
  invalidateBirdCoderCurrentSession();
  invalidateBirdCoderCurrentUser();
  getBirdCoderGlobalTokenManager().clearTokens();
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
}

export async function revokeAppSession(
  options: RevokeAppSessionOptions = {},
): Promise<void> {
  const runtime = options.getRuntime?.() ?? getBirdCoderIamRuntime();
  try {
    await runtime.service.auth.sessions.current.delete();
  } catch {
    // Logout must always clear local state, even when the server session is already gone.
  } finally {
    clearAppSession();
  }
}
