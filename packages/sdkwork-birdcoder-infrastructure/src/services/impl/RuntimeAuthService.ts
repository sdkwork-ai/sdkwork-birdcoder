import {
  createSdkworkCanonicalRuntimeAuthAuthorityService,
} from "../../../../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-runtime-authority.ts";
import type {
  BirdCoderAuthenticatedUserSummary,
  BirdCoderUserCenterApiClient,
  BirdCoderUserCenterEmailCodeLoginRequest,
  BirdCoderUserCenterLoginQrCodeSummary,
  BirdCoderUserCenterLoginQrStatusSummary,
  BirdCoderUserCenterLoginRequest,
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterPasswordResetChallengeRequest,
  BirdCoderUserCenterPasswordResetRequest,
  BirdCoderUserCenterPhoneCodeLoginRequest,
  BirdCoderUserCenterProfileSummary,
  BirdCoderUserCenterRegisterRequest,
  BirdCoderUserCenterSendVerifyCodeRequest,
  BirdCoderUserCenterSessionExchangeRequest,
  BirdCoderUserCenterSessionSummary,
  User,
} from "@sdkwork/birdcoder-types";
import type { IAuthService } from "../interfaces/IAuthService.ts";
import {
  createBirdCoderRuntimeUserCenterClient,
  type BirdCoderRuntimeUserCenterClient,
} from "../userCenterRuntimeBridge.ts";
import {
  clearRuntimeServerSessionId,
  readRuntimeServerSessionId,
  writeRuntimeServerSessionId,
} from "../runtimeServerSession.ts";
import {
  isBirdCoderTransientApiError,
  retryBirdCoderTransientApiTask,
} from "../runtimeApiRetry.ts";

export interface RuntimeAuthServiceOptions {
  client?: BirdCoderUserCenterApiClient;
  runtimeClient?: BirdCoderRuntimeUserCenterClient | null;
}

type RuntimeAuthOAuthDeviceType = "android" | "desktop" | "ios" | "web";

interface RuntimeAuthUser {
  avatarUrl?: string;
  displayName: string;
  email: string;
  firstName: string;
  id?: string;
  initials: string;
  lastName: string;
  username?: string;
}

interface RuntimeAuthSession {
  accessToken: string;
  authToken: string;
  refreshToken?: string;
  user?: RuntimeAuthUser;
}

interface RuntimeSyntheticAuthSessionOptions {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  sessionKey?: string;
}

interface RuntimeAuthLoginQrCode {
  description?: string;
  expireTime?: number;
  qrContent?: string;
  qrKey: string;
  qrUrl?: string;
  title?: string;
  type?: string;
}

type RuntimeAuthLoginQrCodeStatus =
  | "confirmed"
  | "expired"
  | "pending"
  | "scanned";

interface RuntimeAuthLoginQrCodeStatusResult {
  session?: RuntimeAuthSession;
  status: RuntimeAuthLoginQrCodeStatus;
  user?: RuntimeAuthUser;
}

interface RuntimeAuthOAuthAuthorizationInput {
  provider: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

interface RuntimeAuthOAuthLoginInput {
  code: string;
  deviceId?: string;
  deviceType?: RuntimeAuthOAuthDeviceType;
  provider: string;
  state?: string;
}

function normalizeRuntimeAuthText(value: unknown): string | undefined {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || undefined;
}

function splitRuntimeAuthDisplayName(name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (!normalizedName) {
    return {
      firstName: "Sdkwork",
      lastName: "User",
    };
  }

  const [firstName, ...rest] = normalizedName.split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function buildRuntimeAuthInitials(firstName: string, lastName: string): string {
  const initials = [firstName, lastName]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "SU";
}

function createRuntimeAuthUserFromCanonicalIdentity(input: {
  avatarUrl?: string;
  email?: string;
  id?: string;
  name?: string;
  username?: string;
}): RuntimeAuthUser {
  const email = normalizeRuntimeAuthText(input.email) || "";
  const username = normalizeRuntimeAuthText(input.username) || email || undefined;
  const displayName =
    normalizeRuntimeAuthText(input.name)
    || email
    || username
    || "Sdkwork User";
  const { firstName, lastName } = splitRuntimeAuthDisplayName(displayName);
  const id =
    normalizeRuntimeAuthText(input.id)
    || username
    || email
    || undefined;

  return {
    ...(normalizeRuntimeAuthText(input.avatarUrl)
      ? { avatarUrl: normalizeRuntimeAuthText(input.avatarUrl) }
      : {}),
    displayName,
    email,
    firstName,
    ...(id ? { id } : {}),
    initials: buildRuntimeAuthInitials(firstName, lastName),
    lastName,
    ...(username ? { username } : {}),
  };
}

function createRuntimeSyntheticAuthSession(
  user: RuntimeAuthUser,
  options: RuntimeSyntheticAuthSessionOptions = {},
): RuntimeAuthSession {
  const refreshToken = normalizeRuntimeAuthText(options.refreshToken);
  const sessionKey =
    normalizeRuntimeAuthText(options.sessionKey)
    || normalizeRuntimeAuthText(user.id)
    || normalizeRuntimeAuthText(user.username)
    || normalizeRuntimeAuthText(user.email)
    || "sdkwork-user";

  return {
    accessToken: normalizeRuntimeAuthText(options.accessToken) || sessionKey,
    authToken: normalizeRuntimeAuthText(options.authToken) || sessionKey,
    ...(refreshToken ? { refreshToken } : {}),
    user,
  };
}

function createUnavailableError(): Error {
  return new Error(
    "Auth service requires a bound coding-server runtime with user-center APIs.",
  );
}

function isUserCenterRouteUnavailable(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.includes(" -> 404")
  );
}

function isUserCenterSessionRejected(error: unknown): boolean {
  return (
    error instanceof Error
    && (error.message.includes(" -> 401") || error.message.includes(" -> 403"))
  );
}

function isRuntimeAuthAuthorityUnavailable(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.includes("requires a bound coding-server runtime")
  );
}

function mapAuthenticatedUser(user: BirdCoderAuthenticatedUserSummary): User {
  return {
    avatarUrl: user.avatarUrl,
    email: user.email,
    id: user.id,
    name: user.name,
  };
}

function mapProfileUser(profile: BirdCoderUserCenterProfileSummary): User {
  return {
    avatarUrl: profile.avatarUrl,
    email: profile.email,
    id: profile.userId,
    name: profile.displayName || profile.email,
  };
}

function mapUserToAuthSession(
  user: User,
  sessionKey?: string | null,
) {
  return createRuntimeSyntheticAuthSession(
    createRuntimeAuthUserFromCanonicalIdentity({
      avatarUrl: user.avatarUrl,
      email: user.email.trim(),
      id: user.id || user.email.trim(),
      name: user.name?.trim() || user.email.trim(),
      username: user.email.trim(),
    }),
    {
      sessionKey:
        sessionKey?.trim()
        || `birdcoder:${user.id || user.email.trim()}`,
    },
  );
}

function mapBirdCoderQrStatus(
  status: string | undefined,
): RuntimeAuthLoginQrCodeStatus {
  if (
    status === "confirmed"
    || status === "expired"
    || status === "pending"
    || status === "scanned"
  ) {
    return status;
  }

  return "pending";
}

function mapBirdCoderQrCode(
  qrCode: BirdCoderUserCenterLoginQrCodeSummary,
): RuntimeAuthLoginQrCode {
  return {
    ...(typeof qrCode.description === "string" ? { description: qrCode.description } : {}),
    ...(typeof qrCode.expireTime === "number" ? { expireTime: qrCode.expireTime } : {}),
    ...(typeof qrCode.qrContent === "string" ? { qrContent: qrCode.qrContent } : {}),
    qrKey: qrCode.qrKey,
    ...(typeof qrCode.qrUrl === "string" ? { qrUrl: qrCode.qrUrl } : {}),
    ...(typeof qrCode.title === "string" ? { title: qrCode.title } : {}),
    ...(typeof qrCode.type === "string" ? { type: qrCode.type } : {}),
  };
}

function mapBirdCoderQrStatusResult(
  statusResult: BirdCoderUserCenterLoginQrStatusSummary,
): RuntimeAuthLoginQrCodeStatusResult {
  const session = statusResult.session
    ? (() => {
        writeRuntimeServerSessionId(statusResult.session.sessionId);
        return mapUserToAuthSession(
          mapAuthenticatedUser(statusResult.session.user),
          `birdcoder:session:${statusResult.session.sessionId}`,
        );
      })()
    : undefined;
  const resolvedUser =
    session?.user
    ?? (
      statusResult.user
        ? mapUserToAuthSession(
            mapAuthenticatedUser(statusResult.user),
          ).user
        : undefined
    );

  return {
    ...(session ? { session } : {}),
    status: mapBirdCoderQrStatus(statusResult.status),
    ...(resolvedUser ? { user: resolvedUser } : {}),
  };
}

function createRuntimeAuthAuthority(
  options: RuntimeAuthServiceOptions = {},
): IAuthService {
  const client = options.client;

  function requireClient(): BirdCoderUserCenterApiClient {
    if (!client) {
      throw createUnavailableError();
    }

    return client;
  }

  function resolveRuntimeClient(): BirdCoderRuntimeUserCenterClient | null {
    if (options.runtimeClient !== undefined) {
      return options.runtimeClient;
    }

    return createBirdCoderRuntimeUserCenterClient();
  }

  function requireRuntimeClient(): BirdCoderRuntimeUserCenterClient {
    const runtimeClient = resolveRuntimeClient();
    if (!runtimeClient) {
      throw createUnavailableError();
    }

    return runtimeClient;
  }

  return createSdkworkCanonicalRuntimeAuthAuthorityService<
    User,
    BirdCoderUserCenterMetadataSummary,
    BirdCoderUserCenterSessionSummary,
    BirdCoderUserCenterProfileSummary
  >({
    clearSessionToken: clearRuntimeServerSessionId,
    createUnavailableError,
    exchangeSession: options.runtimeClient === null
      ? undefined
      : async (request) => requireRuntimeClient().bootstrapSession(request),
    execute: (task, retryOptions) =>
      retryBirdCoderTransientApiTask(task, retryOptions),
    getConfig: client
      ? async () => client.getConfig()
      : undefined,
    getProfile: options.runtimeClient === null
      ? undefined
      : async () => requireRuntimeClient().getProfile(),
    isRouteUnavailable: isUserCenterRouteUnavailable,
    isSessionRejected: isUserCenterSessionRejected,
    isTransientError: isBirdCoderTransientApiError,
    login: async (request) => requireClient().login(request),
    logout: client ? async () => client.logout() : undefined,
    logoutSession: options.runtimeClient === null
      ? undefined
      : async () => requireRuntimeClient().logoutSession(),
    mapProfileUser,
    mapSessionUser: (session) => mapAuthenticatedUser(session.user),
    readSessionToken: readRuntimeServerSessionId,
    register: async (request) => requireClient().register(request),
    requestPasswordReset: client
      ? async (request) => client.requestPasswordReset(request)
      : undefined,
    resolveSessionToken: (session) => session.sessionId,
    resetPassword: client
      ? async (request) => client.resetPassword(request)
      : undefined,
    sendVerifyCode: client
      ? async (request) => client.sendVerifyCode(request)
      : undefined,
    signInWithEmailCode: client
      ? async (request) => client.loginWithEmailCode(request)
      : undefined,
    signInWithPhoneCode: client
      ? async (request) => client.loginWithPhoneCode(request)
      : undefined,
    writeSessionToken: writeRuntimeServerSessionId,
  }) as IAuthService;
}

export function createBirdCoderRuntimeAuthService(
  options: RuntimeAuthServiceOptions = {},
): IAuthService {
  const authority = createRuntimeAuthAuthority(options) as IAuthService;
  const client = options.client;

  return {
    ...authority,
    getCurrentUser: async () => {
      try {
        return await authority.getCurrentUser();
      } catch (error) {
        if (isRuntimeAuthAuthorityUnavailable(error)) {
          return null;
        }

        throw error;
      }
    },
    logout: async () => {
      try {
        await authority.logout();
      } catch (error) {
        if (isRuntimeAuthAuthorityUnavailable(error)) {
          clearRuntimeServerSessionId();
          return;
        }

        throw error;
      }
    },
    checkLoginQrCodeStatus: client
      ? async (qrKey: string) =>
          mapBirdCoderQrStatusResult(
            await client.checkLoginQrCodeStatus(qrKey),
          )
      : undefined,
    generateLoginQrCode: client
      ? async () =>
          mapBirdCoderQrCode(
            await client.generateLoginQrCode(),
          )
      : undefined,
    getOAuthAuthorizationUrl: client
      ? async (input: RuntimeAuthOAuthAuthorizationInput) =>
          client.getOAuthAuthorizationUrl({
            provider: input.provider,
            redirectUri: input.redirectUri,
            scope: input.scope,
            state: input.state,
          })
      : undefined,
    signInWithOAuth: client
      ? async (input: RuntimeAuthOAuthLoginInput) => {
          const session = await client.loginWithOAuth({
            code: input.code,
            deviceId: input.deviceId,
            deviceType: input.deviceType,
            provider: input.provider,
            state: input.state,
          });
          writeRuntimeServerSessionId(session.sessionId);
          return mapAuthenticatedUser(session.user);
        }
      : undefined,
  };
}

export class RuntimeAuthService implements IAuthService {
  private readonly authority: IAuthService;

  constructor(options: RuntimeAuthServiceOptions = {}) {
    this.authority = createBirdCoderRuntimeAuthService(options);
  }

  exchangeUserCenterSession(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<User> {
    if (!this.authority.exchangeUserCenterSession) {
      throw createUnavailableError();
    }

    return this.authority.exchangeUserCenterSession(request);
  }

  checkLoginQrCodeStatus(
    qrKey: string,
  ): Promise<RuntimeAuthLoginQrCodeStatusResult> {
    if (!this.authority.checkLoginQrCodeStatus) {
      throw createUnavailableError();
    }

    return this.authority.checkLoginQrCodeStatus(qrKey);
  }

  generateLoginQrCode(): Promise<RuntimeAuthLoginQrCode> {
    if (!this.authority.generateLoginQrCode) {
      throw createUnavailableError();
    }

    return this.authority.generateLoginQrCode();
  }

  getUserCenterConfig(): Promise<BirdCoderUserCenterMetadataSummary | null> {
    return this.authority.getUserCenterConfig?.() ?? Promise.resolve(null);
  }

  getCurrentUser(): Promise<User | null> {
    return this.authority.getCurrentUser();
  }

  getOAuthAuthorizationUrl(
    input: RuntimeAuthOAuthAuthorizationInput,
  ): Promise<string> {
    if (!this.authority.getOAuthAuthorizationUrl) {
      throw createUnavailableError();
    }

    return this.authority.getOAuthAuthorizationUrl(input);
  }

  login(
    request: BirdCoderUserCenterLoginRequest | string,
    password?: string,
  ): Promise<User> {
    return this.authority.login(request, password);
  }

  logout(): Promise<void> {
    return this.authority.logout();
  }

  register(
    request: BirdCoderUserCenterRegisterRequest | string,
    password?: string,
    name?: string,
  ): Promise<User> {
    return this.authority.register(request, password, name);
  }

  requestPasswordReset(
    request: BirdCoderUserCenterPasswordResetChallengeRequest,
  ): Promise<void> {
    if (!this.authority.requestPasswordReset) {
      throw createUnavailableError();
    }

    return this.authority.requestPasswordReset(request);
  }

  resetPassword(
    request: BirdCoderUserCenterPasswordResetRequest,
  ): Promise<void> {
    if (!this.authority.resetPassword) {
      throw createUnavailableError();
    }

    return this.authority.resetPassword(request);
  }

  sendVerifyCode(
    request: BirdCoderUserCenterSendVerifyCodeRequest,
  ): Promise<void> {
    if (!this.authority.sendVerifyCode) {
      throw createUnavailableError();
    }

    return this.authority.sendVerifyCode(request);
  }

  signInWithEmailCode(
    request: BirdCoderUserCenterEmailCodeLoginRequest,
  ): Promise<User> {
    if (!this.authority.signInWithEmailCode) {
      throw createUnavailableError();
    }

    return this.authority.signInWithEmailCode(request);
  }

  signInWithOAuth(
    input: RuntimeAuthOAuthLoginInput,
  ): Promise<User> {
    if (!this.authority.signInWithOAuth) {
      throw createUnavailableError();
    }

    return this.authority.signInWithOAuth(input);
  }

  signInWithPhoneCode(
    request: BirdCoderUserCenterPhoneCodeLoginRequest,
  ): Promise<User> {
    if (!this.authority.signInWithPhoneCode) {
      throw createUnavailableError();
    }

    return this.authority.signInWithPhoneCode(request);
  }
}
