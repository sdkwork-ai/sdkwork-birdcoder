import type { IamRuntime } from '@sdkwork/iam-runtime';
import {
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
  type StoredAppSessionToken,
} from './appSessionToken.ts';
import {
  getBirdCoderIamRuntime,
  resetBirdCoderIamRuntime,
} from './iamRuntime.ts';
import {
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
  const result = await runtime.service.auth.sessions.current.retrieve();
  const stored = storeAppSessionFromResult(result);
  resetBirdCoderSdkClients();
  resetBirdCoderIamRuntime();
  return stored;
}

export function getCurrentAppSession(): StoredAppSessionToken | null {
  return loadStoredAppSessionToken();
}

export function clearAppSession(): void {
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
  resetBirdCoderIamRuntime();
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
