import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  createSdkworkIamH5AuthController,
  type SdkworkIamH5AuthController,
} from '@sdkwork/iam-h5-auth';
import { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-h5-core';

export interface BirdCoderH5AuthUser {
  displayName: string;
  email?: string;
  id?: string;
  username?: string;
}

interface BirdCoderH5AuthState {
  authenticated: boolean;
  errorMessage?: string;
  initialized: boolean;
  sessionId?: string;
  user: BirdCoderH5AuthUser | null;
  validating: boolean;
}

export interface BirdCoderH5AuthContextValue extends BirdCoderH5AuthState {
  completeAuthentication(): Promise<boolean>;
  controller: SdkworkIamH5AuthController;
  logout(): Promise<void>;
  refreshCurrentSession(): Promise<boolean>;
}

const INITIAL_AUTH_STATE: BirdCoderH5AuthState = {
  authenticated: false,
  initialized: false,
  user: null,
  validating: true,
};

const BirdCoderH5AuthContext = createContext<BirdCoderH5AuthContextValue | undefined>(
  undefined,
);

function optionalString(value: unknown): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requireAuthenticatedSession(value: unknown): {
  sessionId?: string;
  user: BirdCoderH5AuthUser | null;
} {
  const session = readRecord(value);
  if (!optionalString(session.authToken) || !optionalString(session.accessToken)) {
    throw new Error('IAM current session did not return the required dual-token credentials.');
  }

  const remoteUser = readRecord(session.user);
  const id = optionalString(remoteUser.id) ?? optionalString(remoteUser.userId);
  const username = optionalString(remoteUser.username);
  const email = optionalString(remoteUser.email);
  const displayName = optionalString(remoteUser.displayName)
    ?? optionalString(remoteUser.nickname)
    ?? optionalString(remoteUser.name)
    ?? username
    ?? email;

  return {
    sessionId: optionalString(session.sessionId),
    user: displayName
      ? {
          displayName,
          ...(email ? { email } : {}),
          ...(id ? { id } : {}),
          ...(username ? { username } : {}),
        }
      : null,
  };
}

export function BirdCoderH5AuthProvider({ children }: PropsWithChildren) {
  const runtime = useMemo(() => getBirdCoderIamRuntime(), []);
  const controller = useMemo(
    () => createSdkworkIamH5AuthController({ service: runtime.service }),
    [runtime],
  );
  const [state, setState] = useState<BirdCoderH5AuthState>(INITIAL_AUTH_STATE);
  const activeValidationRef = useRef<Promise<boolean> | null>(null);
  const operationRevisionRef = useRef(0);

  const refreshCurrentSession = useCallback((): Promise<boolean> => {
    if (activeValidationRef.current) {
      return activeValidationRef.current;
    }

    const operationRevision = operationRevisionRef.current + 1;
    operationRevisionRef.current = operationRevision;
    setState((current) => ({
      ...current,
      errorMessage: undefined,
      validating: true,
    }));

    let validation: Promise<boolean>;
    validation = (async () => {
      try {
        await runtime.hydrateTokenManager();
        const tokens = runtime.tokenManager.getTokens();
        if (!optionalString(tokens.authToken) || !optionalString(tokens.accessToken)) {
          if (operationRevisionRef.current === operationRevision) {
            setState({
              authenticated: false,
              initialized: true,
              user: null,
              validating: false,
            });
          }
          return false;
        }

        const currentSession = await runtime.service.auth.sessions.current.retrieve();
        const authenticatedSession = requireAuthenticatedSession(currentSession);
        if (operationRevisionRef.current === operationRevision) {
          setState({
            authenticated: true,
            initialized: true,
            sessionId: authenticatedSession.sessionId,
            user: authenticatedSession.user,
            validating: false,
          });
        }
        return true;
      } catch {
        try {
          await runtime.service.auth.sessions.current.delete();
        } catch {
          // The IAM service clears centralized local session state in its finally path.
        }
        if (operationRevisionRef.current === operationRevision) {
          setState({
            authenticated: false,
            errorMessage: 'Your session could not be validated. Sign in again.',
            initialized: true,
            user: null,
            validating: false,
          });
        }
        return false;
      }
    })().finally(() => {
      if (activeValidationRef.current === validation) {
        activeValidationRef.current = null;
      }
    });

    activeValidationRef.current = validation;
    return validation;
  }, [runtime]);

  const logout = useCallback(async () => {
    const pendingValidation = activeValidationRef.current;
    if (pendingValidation) {
      await pendingValidation.catch(() => false);
    }

    operationRevisionRef.current += 1;
    setState((current) => ({ ...current, validating: true }));
    try {
      await controller.logout();
    } finally {
      setState({
        authenticated: false,
        initialized: true,
        user: null,
        validating: false,
      });
    }
  }, [controller]);

  useEffect(() => {
    void refreshCurrentSession();
  }, [refreshCurrentSession]);

  const value = useMemo<BirdCoderH5AuthContextValue>(() => ({
    ...state,
    completeAuthentication: refreshCurrentSession,
    controller,
    logout,
    refreshCurrentSession,
  }), [controller, logout, refreshCurrentSession, state]);

  return (
    <BirdCoderH5AuthContext.Provider value={value}>
      {children}
    </BirdCoderH5AuthContext.Provider>
  );
}

export function useBirdCoderH5Auth(): BirdCoderH5AuthContextValue {
  const context = useContext(BirdCoderH5AuthContext);
  if (!context) {
    throw new Error('useBirdCoderH5Auth must be used within BirdCoderH5AuthProvider.');
  }
  return context;
}
