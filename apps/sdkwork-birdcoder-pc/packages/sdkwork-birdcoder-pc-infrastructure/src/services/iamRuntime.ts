import {
  createSdkworkAppbasePcAuthRuntime,
  type SdkworkAppbasePcAuthRuntimeComposition,
  type SdkworkAppbasePcAuthRuntimeSdkClient,
} from '@sdkwork/auth-runtime-pc-react/appbasePcAuthRuntime';
import type { IamRuntime } from '@sdkwork/iam-runtime';
import { createAppbaseAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import { hydrateAppSessionPersistence } from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import { syncBirdCoderGlobalTokenManagerFromStorage } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { isBlank } from '@sdkwork/utils/string';
import { BIRDCODER_DEFAULT_LOCAL_API_BASE_URL } from '@sdkwork/birdcoder-pc-host-core';
import { createDriveAppClient, type SdkworkDriveAppClient } from '@sdkwork/drive-app-sdk';
import { createClient as createMessagingAppSdkClient } from '@sdkwork/messaging-app-sdk';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import { startBirdCoderAppSessionRefreshLoop } from './appSessionRefresh.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import {
  getBirdCoderGeneratedAppSdkClient,
  getBirdCoderGlobalTokenManager,
  resetBirdCoderSdkClients,
  setBirdCoderSdkTokenManager,
} from './sdkClients.ts';
import {
  adoptBirdCoderCurrentSession,
  bindBirdCoderCurrentSessionRetriever,
  createBirdCoderCurrentSessionRetriever,
  invalidateBirdCoderCurrentSession,
} from './iamCurrentSession.ts';
import {
  adoptBirdCoderCurrentUser,
  bindBirdCoderCurrentUserRetriever,
  createBirdCoderCurrentUserRetriever,
  invalidateBirdCoderCurrentUser,
} from './iamCurrentUser.ts';

const BIRDCODER_IAM_RUNTIME_APP_ID = 'sdkwork-birdcoder';

function readIamPlatform(): string {
  const target = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_RUNTIME_TARGET') ??
    readBirdCoderRuntimeEnv('SDKWORK_RUNTIME_TARGET') ??
    readDefaultRuntimeTargetFromSurfaceEnv()
  )?.trim().toLowerCase();

  if (target === 'h5' || target === 'h5-browser' || target === 'capacitor') {
    return 'h5';
  }
  if (target === 'flutter-mobile' || target === 'mobile') {
    return 'mobile';
  }
  return 'pc';
}

function readDefaultRuntimeTargetFromSurfaceEnv(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
  };

  return runtimeWindow.__SDKWORK_H5_REACT_ENV__ ? 'h5' : undefined;
}

let sessionChangeListenerRegistered = false;
const contextClearRuntimes = new WeakSet<IamRuntime>();
const contextClearWrappedRuntimes = new WeakSet<IamRuntime>();
const currentUserAuthorityRuntimes = new WeakSet<IamRuntime>();

interface BirdCoderIamRuntimeHostState {
  composition: SdkworkAppbasePcAuthRuntimeComposition | null;
  driveAppClient: SdkworkDriveAppClient | null;
  version: 1;
}

type BirdCoderIamRuntimeHost = typeof globalThis & {
  __SDKWORK_BIRDCODER_IAM_RUNTIME__?: BirdCoderIamRuntimeHostState;
};

function getBirdCoderIamRuntimeHostState(): BirdCoderIamRuntimeHostState {
  const host = globalThis as BirdCoderIamRuntimeHost;
  if (host.__SDKWORK_BIRDCODER_IAM_RUNTIME__?.version !== 1) {
    host.__SDKWORK_BIRDCODER_IAM_RUNTIME__ = {
      composition: null,
      driveAppClient: null,
      version: 1,
    };
  }
  return host.__SDKWORK_BIRDCODER_IAM_RUNTIME__;
}

export function createBirdCoderIamRuntime(): IamRuntime {
  return createBirdCoderIamRuntimeComposition().runtime;
}

export function createBirdCoderIamRuntimeComposition(): SdkworkAppbasePcAuthRuntimeComposition {
  registerBirdCoderIamRuntimeSessionChangeListener();
  const existingComposition = getBirdCoderIamRuntimeHostState().composition;
  if (existingComposition) {
    installBirdCoderCurrentUserAuthority(existingComposition.runtime);
    return existingComposition;
  }

  const tokenManager = getBirdCoderGlobalTokenManager();
  const sdkBaseUrls = resolveBirdCoderRuntimeSdkBaseUrls();
  setBirdCoderSdkTokenManager(tokenManager);

  const birdcoderApp = getBirdCoderGeneratedAppSdkClient({
    apiBaseUrl: sdkBaseUrls.birdcoderAppApiBaseUrl,
    tokenManager,
  });
  const iamPlatform = readIamPlatform();
  const driveApp = createDriveAppClient({
    authMode: 'dual-token',
    baseUrl: sdkBaseUrls.driveAppApiBaseUrl,
    platform: iamPlatform,
    tokenManager,
  });
  const messagingApp = createMessagingAppSdkClient({
    authMode: 'dual-token',
    baseUrl: sdkBaseUrls.messagingAppApiBaseUrl,
    platform: iamPlatform,
    tokenManager,
  });
  const iamAuthorityClient = createAppbaseAppSdkClient({
    authMode: 'dual-token',
    baseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
    platform: iamPlatform,
    tokenManager,
  });

  let runtimeForSessionBridge: IamRuntime | null = null;

  const composition = createSdkworkAppbasePcAuthRuntime({
    app: {
      appId: BIRDCODER_IAM_RUNTIME_APP_ID,
      deploymentMode: readIamDeploymentMode() ?? 'private',
      environment: readIamEnvironment() ?? 'dev',
      platform: iamPlatform,
    },
    baseUrls: {
      appbaseAppApiBaseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
    },
    createAppbaseAppClient: () => createAppbaseAppSdkClient({
      authMode: 'dual-token',
      baseUrl: sdkBaseUrls.appbaseAppApiBaseUrl,
      platform: iamPlatform,
      tokenManager,
    }),
    hooks: {
      onSessionChanged: () => {
        resetBirdCoderSdkClients();
      },
    },
    sdkClients: [
      birdcoderApp,
      driveApp,
      messagingApp,
    ] as SdkworkAppbasePcAuthRuntimeSdkClient[],
    sessionBridge: {
      clearSession: clearBirdCoderIamRuntimeSession,
      commitSession: (session) => commitBirdCoderIamRuntimeSession(
        session,
        runtimeForSessionBridge,
      ),
      readSession: async () => {
        await hydrateAppSessionPersistence();
        return loadStoredAppSessionToken();
      },
    },
    tokenManager,
  });

  const runtime = attachBirdCoderCurrentSessionCoalescer(
    composition.runtime,
    () => iamAuthorityClient.auth.sessions.current.retrieve(),
  );
  installBirdCoderCurrentUserAuthority(
    runtime,
    () => iamAuthorityClient.iam.users.current.retrieve(),
  );
  installBirdCoderContextClearBoundary(runtime);
  runtimeForSessionBridge = runtime;
  const resolvedComposition: SdkworkAppbasePcAuthRuntimeComposition = {
    ...composition,
    getRuntime: () => runtime,
    runtime,
  };
  const hostState = getBirdCoderIamRuntimeHostState();
  hostState.composition = resolvedComposition;
  hostState.driveAppClient = driveApp;
  return resolvedComposition;
}

interface BirdCoderRuntimeSdkBaseUrls {
  appbaseAppApiBaseUrl: string;
  birdcoderAppApiBaseUrl: string;
  driveAppApiBaseUrl: string;
  messagingAppApiBaseUrl: string;
}

function resolveBirdCoderRuntimeSdkBaseUrls(): BirdCoderRuntimeSdkBaseUrls {
  return {
    appbaseAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
      'VITE_SDKWORK_IAM_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    birdcoderAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    driveAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
    messagingAppApiBaseUrl: resolveBirdCoderRuntimeSdkBaseUrl([
      'VITE_SDKWORK_MESSAGING_APP_API_BASE_URL',
      'VITE_SDKWORK_APP_API_BASE_URL',
    ]),
  };
}

function resolveBirdCoderRuntimeSdkBaseUrl(envNames: readonly string[]): string {
  for (const envName of envNames) {
    const envValue = readBirdCoderRuntimeEnv(envName);
    if (envValue) {
      return envValue;
    }
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  if (runtimeConfig.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return BIRDCODER_DEFAULT_LOCAL_API_BASE_URL;
}

export function getBirdCoderDriveAppClient(): SdkworkDriveAppClient {
  const hostState = getBirdCoderIamRuntimeHostState();
  if (!hostState.driveAppClient) {
    createBirdCoderIamRuntimeComposition();
  }
  if (!hostState.driveAppClient) {
    throw new Error('BirdCoder Drive app SDK client is unavailable.');
  }
  return hostState.driveAppClient;
}

export function getBirdCoderIamRuntime(): IamRuntime {
  registerBirdCoderIamRuntimeSessionChangeListener();
  const hostState = getBirdCoderIamRuntimeHostState();
  if (!hostState.composition) {
    hostState.composition = createBirdCoderIamRuntimeComposition();
  }
  installBirdCoderCurrentUserAuthority(hostState.composition.runtime);
  return hostState.composition.runtime;
}

export function resetBirdCoderIamRuntime(): void {
  invalidateBirdCoderCurrentSession();
  invalidateBirdCoderCurrentUser();
  const hostState = getBirdCoderIamRuntimeHostState();
  hostState.composition = null;
  hostState.driveAppClient = null;
}

function clearBirdCoderIamRuntimeSession(): void {
  invalidateBirdCoderCurrentSession();
  invalidateBirdCoderCurrentUser();
  // The unauthorized boundary can invoke this bridge directly, bypassing
  // the IAM runtime's normal clearSession hook. Clear the shared manager
  // explicitly so a rejected request cannot leave stale credentials attached
  // to the next current-session validation.
  getBirdCoderGlobalTokenManager().clearTokens();
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
}

function commitBirdCoderIamRuntimeSession(
  session: unknown,
  runtime: IamRuntime | null,
): ReturnType<typeof storeAppSessionFromResult> {
  const record = typeof session === 'object' && session !== null
    ? session as Record<string, unknown>
    : {};
  const preserveSessionMetadata = runtime && contextClearRuntimes.has(runtime)
    ? false
    : !(
      Object.prototype.hasOwnProperty.call(record, 'user')
      && !Object.prototype.hasOwnProperty.call(record, 'context')
    );
  const stored = storeAppSessionFromResult(session, {
    // The bridge removes identity fields from the token-only phase. Preserve
    // the existing user/context until its explicit context commit follows.
    preserveSessionMetadata,
  });
  syncBirdCoderGlobalTokenManagerFromStorage();
  if (runtime) {
    const adoptedSession = {
      ...(session as object),
      ...stored,
    };
    adoptBirdCoderCurrentSession(runtime, adoptedSession);
    if (stored.user) {
      adoptBirdCoderCurrentUser(runtime, stored.user, stored);
    }
  }
  resetBirdCoderSdkClients();
  return stored;
}

function installBirdCoderContextClearBoundary(runtime: IamRuntime): void {
  if (contextClearWrappedRuntimes.has(runtime)) {
    return;
  }
  contextClearWrappedRuntimes.add(runtime);
  const contextStore = runtime.contextStore;
  const originalClear = contextStore.clear.bind(contextStore);
  contextStore.clear = async () => {
    contextClearRuntimes.add(runtime);
    try {
      await originalClear();
    } finally {
      contextClearRuntimes.delete(runtime);
    }
  };
}

function attachBirdCoderCurrentSessionCoalescer(
  runtime: IamRuntime,
  rawRetrieve: () => Promise<unknown>,
): IamRuntime {
  const registrations = runtime.service.auth.registrations;
  const sessions = runtime.service.auth.sessions;
  const currentSession = runtime.service.auth.sessions.current;
  const oauthSessions = runtime.service.oauth.sessions;
  bindBirdCoderCurrentSessionRetriever(runtime, rawRetrieve);

  runtime.service = {
    ...runtime.service,
    auth: {
      ...runtime.service.auth,
      registrations: {
        ...registrations,
        create: async (body) => commitReturnedBirdCoderIamSession(
          runtime,
          await registrations.create(body),
        ),
      },
      sessions: {
        ...sessions,
        create: async (body) => commitReturnedBirdCoderIamSession(
          runtime,
          await sessions.create(body),
        ),
        loginContextSelection: {
          ...sessions.loginContextSelection,
          create: async (body) => commitReturnedBirdCoderIamSession(
            runtime,
            await sessions.loginContextSelection.create(body),
          ),
        },
        organizationSelection: {
          ...sessions.organizationSelection,
          create: async (body) => commitReturnedBirdCoderIamSession(
            runtime,
            await sessions.organizationSelection.create(body),
          ),
        },
        current: {
          ...currentSession,
          retrieve: createBirdCoderCurrentSessionRetriever(runtime),
          update: async (body) => commitReturnedBirdCoderIamSession(
            runtime,
            await currentSession.update(body),
          ),
        },
        refresh: async (body) => commitReturnedBirdCoderIamSession(
          runtime,
          await sessions.refresh(body),
        ),
      },
    },
    oauth: {
      ...runtime.service.oauth,
      sessions: {
        ...oauthSessions,
        create: async (body) => commitReturnedBirdCoderIamSession(
          runtime,
          await oauthSessions.create(body),
        ),
      },
    },
  };
  return runtime;
}

function attachBirdCoderCurrentUserCoalescer(runtime: IamRuntime): void {
  const iam = runtime.service.iam;
  const users = iam.users;
  const currentUser = users.current;
  runtime.service = {
    ...runtime.service,
    iam: {
      ...iam,
      users: {
        ...users,
        current: {
          ...currentUser,
          retrieve: createBirdCoderCurrentUserRetriever(runtime),
        },
      },
    },
  };
}

function installBirdCoderCurrentUserAuthority(
  runtime: IamRuntime,
  rawRetrieve?: () => Promise<unknown>,
): void {
  if (currentUserAuthorityRuntimes.has(runtime)) {
    return;
  }

  let retrieve = rawRetrieve;
  if (!retrieve) {
    const client = createAppbaseAppSdkClient({
      authMode: 'dual-token',
      baseUrl: runtime.config.appApiBaseUrl ?? resolveBirdCoderRuntimeSdkBaseUrl([
        'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
        'VITE_SDKWORK_IAM_APP_API_BASE_URL',
        'VITE_SDKWORK_APP_API_BASE_URL',
      ]),
      platform: readIamPlatform(),
      tokenManager: runtime.tokenManager,
    });
    retrieve = () => client.iam.users.current.retrieve();
  }

  bindBirdCoderCurrentUserRetriever(runtime, retrieve);
  attachBirdCoderCurrentUserCoalescer(runtime);
  currentUserAuthorityRuntimes.add(runtime);
}

function commitReturnedBirdCoderIamSession<T>(runtime: IamRuntime, session: T): T {
  if (typeof session !== 'object' || session === null) {
    return session;
  }
  const record = session as Record<string, unknown>;
  if (
    typeof record.authToken !== 'string'
    || !record.authToken.trim()
    || typeof record.accessToken !== 'string'
    || !record.accessToken.trim()
  ) {
    return session;
  }
  commitBirdCoderIamRuntimeSession(session, runtime);
  return session;
}

function registerBirdCoderIamRuntimeSessionChangeListener(): void {
  if (sessionChangeListenerRegistered) {
    return;
  }

  sessionChangeListenerRegistered = true;
  startBirdCoderAppSessionRefreshLoop();
  try {
    const host = globalThis as typeof globalThis & {
      __SDKWORK_BIRDCODER_IAM_SESSION_CHANGE_LISTENER__?: EventListener;
    };
    const previousListener = host.__SDKWORK_BIRDCODER_IAM_SESSION_CHANGE_LISTENER__;
    if (previousListener) {
      globalThis.removeEventListener?.(
        APP_SESSION_CHANGE_EVENT_NAME,
        previousListener,
      );
    }

    const listener: EventListener = handleBirdCoderIamRuntimeSessionChange;
    globalThis.addEventListener?.(
      APP_SESSION_CHANGE_EVENT_NAME,
      listener,
    );
    host.__SDKWORK_BIRDCODER_IAM_SESSION_CHANGE_LISTENER__ = listener;
  } catch {
    // Non-browser runtimes still use the session bridge directly; there is no global event target to bind.
  }
}

function handleBirdCoderIamRuntimeSessionChange(): void {
  // Token/context stores and every SDK client share the same TokenManager.
  // Recreating the runtime here produced competing old/new providers after
  // every login commit and was a primary source of duplicate bootstrap calls.
  syncBirdCoderGlobalTokenManagerFromStorage();
}

export function readBirdCoderRuntimeEnv(name: string): string | undefined {
  const windowValue = readRuntimeEnvFromWindow(name);
  if (windowValue) {
    return windowValue;
  }

  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  const value = meta.env?.[name];
  return readNonBlankString(value);
}

function readNonBlankString(value: unknown): string | undefined {
  if (typeof value !== 'string' || isBlank(value)) {
    return undefined;
  }
  return value.trim();
}

function readRuntimeEnvFromWindow(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    __SDKWORK_PC_REACT_ENV__?: Record<string, unknown>;
    __SDKWORK_H5_REACT_ENV__?: Record<string, unknown>;
    __BIRDCODER_ENV__?: Record<string, unknown>;
  };
  const value =
    runtimeWindow.__BIRDCODER_ENV__?.[name] ??
    runtimeWindow.__SDKWORK_H5_REACT_ENV__?.[name] ??
    runtimeWindow.__SDKWORK_PC_REACT_ENV__?.[name];
  return readNonBlankString(value);
}

function readIamDeploymentMode(): 'local' | 'private' | 'saas' | undefined {
  const value = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_DEPLOYMENT_MODE') ??
    readBirdCoderRuntimeEnv('VITE_BIRDCODER_IAM_DEPLOYMENT_MODE')
  )?.trim().toLowerCase();
  return value === 'local' || value === 'private' || value === 'saas' ? value : undefined;
}

function readIamEnvironment(): 'dev' | 'prod' | 'test' | undefined {
  const value = (
    readBirdCoderRuntimeEnv('VITE_SDKWORK_ENVIRONMENT') ??
    readBirdCoderRuntimeEnv('MODE') ??
    readBirdCoderRuntimeEnv('SDKWORK_VITE_MODE')
  )?.trim().toLowerCase();

  if (value === 'production' || value === 'prod') {
    return 'prod';
  }
  if (value === 'test') {
    return 'test';
  }
  if (value === 'development' || value === 'dev') {
    return 'dev';
  }
  return undefined;
}
