import type { IamAppContext } from '@sdkwork/iam-contracts';
import type { AuthTokenManager, AuthTokens } from '@sdkwork/sdk-common';

export interface BirdCoderSessionUser {
  avatar?: string;
  chatId?: string;
  displayName?: string;
  email?: string;
  id?: string | number;
  name?: string;
  nickname?: string;
  phone?: string;
  userId?: string;
  username?: string;
}

export interface BirdCoderSessionTokens {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
}

export interface BirdCoderAppContext extends IamAppContext {
  actorId?: string;
  actorKind?: string;
  deviceId?: string;
}

export interface BirdCoderSession extends BirdCoderSessionTokens {
  context?: BirdCoderAppContext;
  expiresAt?: number;
  sessionId?: string;
  user?: BirdCoderSessionUser;
}

export interface BirdCoderSessionChangedDetail {
  session: BirdCoderSession | null;
}

const BIRDCODER_SESSION_KEY = 'sdkwork-birdcoder-pc:session:v1';
export const BIRDCODER_SESSION_CHANGED_EVENT = 'sdkwork-birdcoder-pc:auth-session-changed';

let birdcoderGlobalTokenManager: AuthTokenManager | null = null;
let birdcoderGlobalTokenManagerSession: BirdCoderSession | null = null;

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.localStorage;
}

function dispatchAppSdkSessionChanged(session: BirdCoderSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(
    BIRDCODER_SESSION_CHANGED_EVENT,
    { detail: { session } },
  ));
}

function normalizeToken(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean) as string[];
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return [];
  }
  const separator = normalized.includes(',') ? /,/u : /\s+/u;
  return normalized
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeExpiresAt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | undefined {
  try {
    const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function decodeJwtClaims(token?: string): Record<string, unknown> | undefined {
  const normalized = normalizeToken(token);
  if (!normalized) {
    return undefined;
  }
  const [, payload] = normalized.split('.');
  if (!payload) {
    return undefined;
  }
  return decodeBase64UrlJson(payload);
}

function readSessionJwtClaims(session?: BirdCoderSession | null): Record<string, unknown>[] {
  return [
    decodeJwtClaims(session?.accessToken),
    decodeJwtClaims(session?.authToken),
  ].filter(Boolean) as Record<string, unknown>[];
}

function pickClaimString(
  session: BirdCoderSession | null | undefined,
  claimKeys: string[],
  ...fallbacks: unknown[]
): string | undefined {
  for (const claims of readSessionJwtClaims(session)) {
    for (const key of claimKeys) {
      const value = normalizeString(claims[key]);
      if (value) {
        return value;
      }
    }
  }
  return normalizeString(fallbacks.find((value) => normalizeString(value)));
}

function pickClaimStringArray(
  session: BirdCoderSession | null | undefined,
  claimKeys: string[],
  fallback?: unknown,
): string[] {
  for (const claims of readSessionJwtClaims(session)) {
    for (const key of claimKeys) {
      const values = normalizeStringArray(claims[key]);
      if (values.length > 0) {
        return values;
      }
    }
  }
  return normalizeStringArray(fallback);
}

function normalizeContext(value: unknown): BirdCoderAppContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const context = value as Partial<IamAppContext>;
  const record = value as Record<string, unknown>;
  const appId = normalizeString(context.appId) ?? normalizeString(record.app_id);
  const tenantId = normalizeString(context.tenantId) ?? normalizeString(record.tenant_id);
  const userId = normalizeString(context.userId) ?? normalizeString(record.user_id);
  const sessionId = normalizeString(context.sessionId) ?? normalizeString(record.session_id);
  const organizationId = normalizeString(context.organizationId) ?? normalizeString(record.organization_id);
  const environment = normalizeString(context.environment) ?? normalizeString(record.env);
  const deploymentMode = normalizeString(context.deploymentMode) ?? normalizeString(record.deployment_mode);
  const authLevel = normalizeString(context.authLevel) ?? normalizeString(record.auth_level);
  if (!appId || !tenantId || !userId) {
    return undefined;
  }
  return {
    ...context,
    appId,
    ...(organizationId ? { organizationId } : {}),
    tenantId,
    userId,
    sessionId: sessionId ?? '',
    environment: (environment ?? 'dev') as IamAppContext['environment'],
    deploymentMode: (deploymentMode ?? 'saas') as IamAppContext['deploymentMode'],
    authLevel: (authLevel ?? 'password') as IamAppContext['authLevel'],
    dataScope: normalizeStringArray(context.dataScope ?? record.data_scope),
    permissionScope: normalizeStringArray(context.permissionScope ?? record.permission_scope),
  };
}

export function normalizeBirdCoderSessionUser(value: unknown): BirdCoderSessionUser | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const user = value as Partial<BirdCoderSessionUser>;
  const id = normalizeString(user.userId) ?? normalizeString(user.id);
  const avatar = normalizeString(user.avatar);
  const userRecord = value as Record<string, unknown>;
  const chatId = normalizeString(userRecord.chatId)
    ?? normalizeString(userRecord.chat_id)
    ?? normalizeString(userRecord.imId)
    ?? normalizeString(userRecord.im_id)
    ?? normalizeString(userRecord.birdcoderChatId)
    ?? normalizeString(userRecord.birdcoder_chat_id);
  const normalized: BirdCoderSessionUser = {
    ...(avatar ? { avatar } : {}),
    ...(chatId ? { chatId } : {}),
    ...(normalizeString(user.displayName) ? { displayName: normalizeString(user.displayName) } : {}),
    ...(normalizeString(user.email) ? { email: normalizeString(user.email) } : {}),
    ...(id ? { id } : {}),
    ...(normalizeString(user.name) ? { name: normalizeString(user.name) } : {}),
    ...(normalizeString(user.nickname) ? { nickname: normalizeString(user.nickname) } : {}),
    ...(normalizeString(user.phone) ? { phone: normalizeString(user.phone) } : {}),
    ...(normalizeString(user.userId) ? { userId: normalizeString(user.userId) } : {}),
    ...(normalizeString(user.username) ? { username: normalizeString(user.username) } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeSession(value: unknown): BirdCoderSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as BirdCoderSession & { expiresAt?: unknown };
  const context = normalizeContext(candidate.context);
  const sessionId = normalizeString(candidate.sessionId) ?? normalizeString(context?.sessionId);
  const session: BirdCoderSession = {
    accessToken: normalizeToken(candidate.accessToken),
    authToken: normalizeToken(candidate.authToken),
    refreshToken: normalizeToken(candidate.refreshToken),
    ...(context ? { context } : {}),
    ...(typeof candidate.expiresAt !== 'undefined'
      ? { expiresAt: normalizeExpiresAt(candidate.expiresAt) }
      : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(normalizeBirdCoderSessionUser(candidate.user) ? { user: normalizeBirdCoderSessionUser(candidate.user) } : {}),
  };

  return session.authToken && session.accessToken ? session : null;
}

export function readAppSdkSessionTokens(): BirdCoderSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(BIRDCODER_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(rawValue));
  } catch {
    storage.removeItem(BIRDCODER_SESSION_KEY);
    return null;
  }
}

export function persistAppSdkSessionTokens(session: BirdCoderSession): BirdCoderSession {
  const normalizedSession = normalizeSession(session);
  if (!normalizedSession) {
    clearAppSdkSessionTokens();
    throw new Error('BirdCoder session requires authToken and accessToken.');
  }

  getStorage()?.setItem(BIRDCODER_SESSION_KEY, JSON.stringify(normalizedSession));
  syncBirdcoderGlobalTokenManager(normalizedSession);
  dispatchAppSdkSessionChanged(normalizedSession);
  return normalizedSession;
}

export function applyAppSdkSessionTokens(session: BirdCoderSession): BirdCoderSession {
  return persistAppSdkSessionTokens(session);
}

export function clearAppSdkSessionTokens(): void {
  getStorage()?.removeItem(BIRDCODER_SESSION_KEY);
  syncBirdcoderGlobalTokenManager(null);
  dispatchAppSdkSessionChanged(null);
}

export function resolveAppSdkAccessToken(session = readAppSdkSessionTokens()): string | undefined {
  return session?.accessToken;
}

export function resolveAppSdkAuthToken(session = readAppSdkSessionTokens()): string | undefined {
  return session?.authToken;
}

export function resolveAppSdkRefreshToken(session = readAppSdkSessionTokens()): string | undefined {
  return session?.refreshToken;
}

export function resolveAppSdkTenantId(session = readAppSdkSessionTokens()): string | undefined {
  return pickClaimString(session, ['tenantId', 'tenant_id', 'tid'], session?.context?.tenantId);
}

export function resolveAppSdkOrganizationId(session = readAppSdkSessionTokens()): string | undefined {
  return pickClaimString(
    session,
    ['organizationId', 'organization_id', 'orgId', 'org_id', 'oid'],
    session?.context?.organizationId,
  );
}

export function resolveAppSdkUserId(session = readAppSdkSessionTokens()): string | undefined {
  return pickClaimString(
    session,
    ['userId', 'user_id', 'uid', 'sub', 'principalId', 'principal_id', 'accountId', 'account_id'],
    session?.context?.userId,
    session?.user?.userId,
    session?.user?.id,
  );
}

export function resolveAppSdkSessionId(session = readAppSdkSessionTokens()): string | undefined {
  return pickClaimString(
    session,
    ['sessionId', 'session_id', 'sid'],
    session?.sessionId,
    session?.context?.sessionId,
  );
}

function resolveAppSdkAppId(session?: BirdCoderSession | null): string | undefined {
  return pickClaimString(session, ['appId', 'app_id', 'azp', 'aud'], session?.context?.appId);
}

function resolveAppSdkEnvironment(session?: BirdCoderSession | null): string | undefined {
  return pickClaimString(session, ['environment', 'env'], session?.context?.environment);
}

function resolveAppSdkDeploymentMode(session?: BirdCoderSession | null): string | undefined {
  return pickClaimString(session, ['deploymentMode', 'deployment_mode'], session?.context?.deploymentMode);
}

function resolveAppSdkAuthLevel(session?: BirdCoderSession | null): string | undefined {
  return pickClaimString(session, ['authLevel', 'auth_level', 'acr'], session?.context?.authLevel);
}

export function createBirdcoderSessionTokenManager(
  sessionOrReader?: BirdCoderSession | null | (() => BirdCoderSession | null),
): AuthTokenManager {
  let currentSession = typeof sessionOrReader === 'function' ? null : sessionOrReader ?? null;
  const readConfiguredSession = () => (
    typeof sessionOrReader === 'function'
      ? sessionOrReader()
      : currentSession
  );
  const readCurrentSession = () => readConfiguredSession() ?? readAppSdkSessionTokens();
  const isExpired = () => {
    const expiresAt = readCurrentSession()?.expiresAt;
    return typeof expiresAt === 'number' && Number.isFinite(expiresAt) && Date.now() >= expiresAt;
  };
  const updateTokens = (tokens: AuthTokens): void => {
    const existing = readCurrentSession() ?? {};
    const expiresAt = typeof tokens.expiresAt === 'number' && Number.isFinite(tokens.expiresAt)
      ? tokens.expiresAt
      : typeof tokens.expiresIn === 'number' && Number.isFinite(tokens.expiresIn)
        ? Date.now() + tokens.expiresIn * 1000
        : existing.expiresAt;
    currentSession = applyAppSdkSessionTokens({
      ...existing,
      accessToken: tokens.accessToken ?? existing.accessToken,
      authToken: tokens.authToken ?? existing.authToken,
      refreshToken: tokens.refreshToken ?? existing.refreshToken,
      ...(expiresAt ? { expiresAt } : {}),
    });
  };
  const patchTokens = (tokens: Partial<BirdCoderSessionTokens>): void => {
    const existing = readCurrentSession() ?? {};
    const next = {
      ...existing,
      ...tokens,
    };
    const normalizedSession = normalizeSession(next);
    if (!normalizedSession) {
      currentSession = null;
      clearAppSdkSessionTokens();
      return;
    }
    currentSession = applyAppSdkSessionTokens(normalizedSession);
  };

  const hasDualTokens = () => {
    const current = readCurrentSession();
    return Boolean(current?.authToken && current?.accessToken);
  };

  return {
    getAuthToken: () => resolveAppSdkAuthToken(readCurrentSession()),
    getAccessToken: () => resolveAppSdkAccessToken(readCurrentSession()),
    getRefreshToken: () => resolveAppSdkRefreshToken(readCurrentSession()),
    getTokens: () => {
      const current = readCurrentSession();
      return {
        ...(current?.accessToken ? { accessToken: current.accessToken } : {}),
        ...(current?.authToken ? { authToken: current.authToken } : {}),
        ...(current?.refreshToken ? { refreshToken: current.refreshToken } : {}),
        ...(current?.expiresAt ? { expiresAt: current.expiresAt } : {}),
      };
    },
    setTokens: updateTokens,
    setAccessToken: (token: string) => patchTokens({ accessToken: normalizeToken(token) }),
    setAuthToken: (token: string) => patchTokens({ authToken: normalizeToken(token) }),
    setRefreshToken: (token: string) => patchTokens({ refreshToken: normalizeToken(token) }),
    clearTokens: () => {
      currentSession = null;
      clearAppSdkSessionTokens();
    },
    clearAuthToken: () => patchTokens({ authToken: undefined }),
    clearAccessToken: () => patchTokens({ accessToken: undefined }),
    isExpired,
    isValid: () => hasDualTokens() && !isExpired(),
    hasToken: () => hasDualTokens(),
    hasAuthToken: () => Boolean(resolveAppSdkAuthToken(readCurrentSession())),
    hasAccessToken: () => Boolean(resolveAppSdkAccessToken(readCurrentSession())),
    willExpireIn: (seconds: number) => {
      const expiresAt = readCurrentSession()?.expiresAt;
      return typeof expiresAt === 'number' && Number.isFinite(expiresAt) && Date.now() + seconds * 1000 >= expiresAt;
    },
  };
}

export function syncBirdcoderGlobalTokenManager(session: BirdCoderSession | null = readAppSdkSessionTokens()): void {
  birdcoderGlobalTokenManagerSession = session ? normalizeSession(session) : null;
}

export function getBirdcoderGlobalTokenManager(): AuthTokenManager {
  syncBirdcoderGlobalTokenManager(readAppSdkSessionTokens());
  if (!birdcoderGlobalTokenManager) {
    birdcoderGlobalTokenManager = createBirdcoderSessionTokenManager(
      () => birdcoderGlobalTokenManagerSession,
    );
  }
  return birdcoderGlobalTokenManager;
}

export function isAppSdkSessionExpired(session = readAppSdkSessionTokens()): boolean {
  const expiresAt = session?.expiresAt;
  return typeof expiresAt === 'number' && Number.isFinite(expiresAt) && Date.now() >= expiresAt;
}

export function isAppSdkSessionAuthenticated(session = readAppSdkSessionTokens()): boolean {
  return Boolean(session?.authToken && session?.accessToken) && !isAppSdkSessionExpired(session);
}
