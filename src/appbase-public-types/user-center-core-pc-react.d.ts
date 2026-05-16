export type UserCenterRuntimeRequestMethod =
  | "DELETE"
  | "GET"
  | "PATCH"
  | "POST"
  | "PUT";

export type UserCenterPluginCapabilityName = "auth" | "user" | "vip";

export type UserCenterStandardAppRouteKey =
  | "authConfig"
  | "authSession"
  | "exchangeUserCenterSession"
  | "getCurrentUserMembership"
  | "getCurrentUserProfile"
  | "login"
  | "loginWithEmailCode"
  | "loginWithPhoneCode"
  | "logout"
  | "requestPasswordReset"
  | "register"
  | "resetPassword"
  | "sendVerifyCode"
  | "updateCurrentUserMembership"
  | "updateCurrentUserProfile";

export type UserCenterStandardAppOperationId =
  | "app.exchangeUserCenterSession"
  | "app.getCurrentUserMembership"
  | "app.getCurrentUserProfile"
  | "app.getCurrentUserSession"
  | "app.getUserCenterConfig"
  | "app.login"
  | "app.loginWithEmailCode"
  | "app.loginWithPhoneCode"
  | "app.logout"
  | "app.requestPasswordReset"
  | "app.register"
  | "app.resetPassword"
  | "app.sendVerifyCode"
  | "app.updateCurrentUserMembership"
  | "app.updateCurrentUserProfile";

export type UserCenterProviderKind =
  | "builtin-local"
  | "external-user-center"
  | "sdkwork-cloud-app-api";

export const USER_CENTER_SOURCE_PACKAGE_NAME: "@sdkwork/user-center-core-pc-react";

export interface UserCenterRoutes {
  authBasePath: string;
  userRoutePath: string;
  vipRoutePath: string;
}

export interface UserCenterLocalApiRoutes {
  account: string;
  accountSummary: string;
  authConfig: string;
  authEmailLogin: string;
  authLogin: string;
  authLogout: string;
  authOAuthLogin: string;
  authOAuthUrl: string;
  authPasswordReset: string;
  authPasswordResetRequest: string;
  authPhoneLogin: string;
  authQrCallbackPattern: string;
  authQrConfirm: string;
  authQrEntryPattern: string;
  authQrGenerate: string;
  authQrStatusPattern: string;
  authRefresh: string;
  authRegister: string;
  authSession: string;
  authSessionExchange: string;
  authVerifyCheck: string;
  authVerifySend: string;
  health: string;
  membership: string;
  preferences: string;
  profile: string;
  sessionBootstrap: string;
  sessionLogin: string;
  sessionLogout: string;
  sessionRefresh: string;
  tenant: string;
  tenantRoot: string;
  userProfile: string;
  userSettings: string;
  vipInfo: string;
}

export interface UserCenterTokenBundle {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  sessionToken?: string;
  tokenType?: string;
}

export interface UserCenterStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface UserCenterTokenStore {
  clearTokenBundle(): void;
  persistTokenBundle(bundle: UserCenterTokenBundle): boolean;
  readTokenBundle(): UserCenterTokenBundle;
}

export interface UserCenterStoragePlan {
  accessTokenHeaderName?: string;
  accessTokenKey: string;
  authTokenKey: string;
  authorizationHeaderName?: string;
  refreshTokenHeaderName?: string;
  refreshTokenKey: string;
  sessionHeaderName: string;
  sessionTokenKey: string;
  storageScope?: string;
  tokenTypeKey: string;
}

export interface UserCenterStandardTokenHeaders {
  accessTokenHeaderName: string;
  authorizationHeaderName: string;
  refreshTokenHeaderName: string;
}

export interface UserCenterBridgeConfigInput {
  auth?: Record<string, unknown>;
  localApiBasePath: string;
  mode?: string;
  namespace: string;
  provider?: {
    baseUrl?: string;
    headers?: Record<string, string>;
    kind: UserCenterProviderKind | string;
    providerKey?: string;
  };
  routes?: Partial<UserCenterRoutes>;
  storage?: Record<string, unknown>;
  storagePlan?: Partial<UserCenterStoragePlan>;
  storageTopology?: Record<string, unknown>;
}

export interface UserCenterBridgeConfig extends UserCenterBridgeConfigInput {
  localApiRoutes: UserCenterLocalApiRoutes;
  storagePlan: UserCenterStoragePlan;
}

export interface UserCenterRuntimeConfig {
  apiBaseUrl: string | null;
  bridgeConfig: UserCenterBridgeConfig;
  localApiBasePath: string;
  namespace: string;
  provider: UserCenterBridgeConfigInput["provider"];
  routes: UserCenterRoutes;
  storagePlan: UserCenterStoragePlan;
}

export interface UserCenterRuntimeClientOptions {
  fetch?: typeof fetch;
  resolveValidationInteropContract?: () => unknown;
  tokenStore?: UserCenterTokenStore;
  validationInteropContract?: unknown;
}

export interface UserCenterRuntimeClient {
  bootstrapSession<TRequest = unknown, TResult = unknown>(
    request: TRequest,
  ): Promise<TResult>;
  getMembership<T = unknown>(): Promise<T>;
  getPreferences<T = unknown>(): Promise<T>;
  getProfile<T = unknown>(): Promise<T>;
  logoutSession(): Promise<void>;
  updateMembership<T = unknown, TPayload = unknown>(
    payload: TPayload,
  ): Promise<T>;
  updatePreferences<TPayload = unknown, TResult = unknown>(
    payload: TPayload,
  ): Promise<TResult>;
  updateProfile<T = unknown, TPayload = unknown>(payload: TPayload): Promise<T>;
}

export interface CanonicalUserCenterRuntimeBridge {
  apiBaseUrl: string | null;
  bridgeConfig: UserCenterBridgeConfig;
  runtimeClient: UserCenterRuntimeClient | null;
  runtimeConfig: UserCenterRuntimeConfig;
}

export interface UserCenterRuntimeProviderBinding {
  baseUrl?: string | null;
  providerKey?: string | null;
  providerKind?: "external-user-center" | "sdkwork-cloud-app-api" | null;
}

export interface CreateCanonicalUserCenterRuntimeBridgeOptions
  extends Omit<UserCenterBridgeConfigInput, "provider"> {
  provider?: UserCenterBridgeConfigInput["provider"];
  resolveRuntimeBinding?:
    | UserCenterRuntimeProviderBinding
    | (() => UserCenterRuntimeProviderBinding | null | undefined)
    | null;
  runtimeClientOptions?: UserCenterRuntimeClientOptions;
  storage: Record<string, unknown>;
}

export interface CreateSdkworkCanonicalUserCenterConfigOptions {
  localApiBasePath?: string;
  provider?: UserCenterBridgeConfigInput["provider"];
}

export interface UserCenterPluginDefinition {
  capabilities: readonly UserCenterPluginCapabilityName[];
  namespace: string;
  packageNames: readonly string[];
  routes: UserCenterRoutes;
  sourcePackageName: string;
  title: string;
}

export interface UserCenterServerOperationContract {
  authMode: string;
  method: UserCenterRuntimeRequestMethod;
  operation: string;
  path: string;
  surface: string;
}

export interface UserCenterServerPluginDefinition extends UserCenterPluginDefinition {
  operations: readonly UserCenterServerOperationContract[];
}

export interface UserCenterHandshakeSignature {
  algorithm: string;
  signature: string;
  signedAt: string;
}

export interface UserCenterHandshakeVerificationContext {
  headers: Record<string, string>;
  message: string;
}

export interface CreateSdkworkCanonicalUserCenterPluginDefinitionOptions {
  capabilities?: readonly UserCenterPluginCapabilityName[];
}

export interface CreateSdkworkCanonicalUserCenterServerPluginDefinitionOptions
  extends CreateSdkworkCanonicalUserCenterPluginDefinitionOptions {}

export interface CreateSdkworkCanonicalUserCenterHandshakeSigningMessageOptions {
  nonce: string;
  timestamp: string;
}

export interface CreateSdkworkCanonicalUserCenterSignedHandshakeHeadersOptions
  extends CreateSdkworkCanonicalUserCenterHandshakeSigningMessageOptions {
  signature: UserCenterHandshakeSignature;
}

export interface CreateSdkworkCanonicalUserCenterHandshakeVerificationContextOptions {
  headers: Record<string, string>;
}

export interface CreateSdkworkCanonicalUserCenterDefinitionOptions {
  capabilities: readonly UserCenterPluginCapabilityName[];
  namespace: string;
  packageNames: readonly string[];
  routes: UserCenterRoutes;
  title: string;
}

export interface SdkworkCanonicalUserCenterDefinition
  extends CreateSdkworkCanonicalUserCenterDefinitionOptions {
  localApiRoutes: UserCenterLocalApiRoutes;
  sourcePackageName: typeof USER_CENTER_SOURCE_PACKAGE_NAME;
  createConfig(
    options?: CreateSdkworkCanonicalUserCenterConfigOptions,
  ): UserCenterBridgeConfig;
  createHandshakeSigningMessage(
    options: CreateSdkworkCanonicalUserCenterHandshakeSigningMessageOptions,
  ): string;
  createHandshakeVerificationContext(
    options: CreateSdkworkCanonicalUserCenterHandshakeVerificationContextOptions,
  ): UserCenterHandshakeVerificationContext;
  createPluginDefinition(
    options?: CreateSdkworkCanonicalUserCenterPluginDefinitionOptions,
  ): UserCenterPluginDefinition;
  createServerOperations(
    options?: CreateSdkworkCanonicalUserCenterServerPluginDefinitionOptions,
  ): readonly UserCenterServerOperationContract[];
  createServerPluginDefinition(
    options?: CreateSdkworkCanonicalUserCenterServerPluginDefinitionOptions,
  ): UserCenterServerPluginDefinition;
  createSignedHandshakeHeaders(
    options: CreateSdkworkCanonicalUserCenterSignedHandshakeHeadersOptions,
  ): Record<string, string>;
}

export interface UserCenterProtectedTokenResolutionOptions {
  tokenBundle?: UserCenterTokenBundle;
  token?: string | null;
}

export interface UserCenterProtectedTokenRequirementOptions
  extends UserCenterProtectedTokenResolutionOptions {
  message?: string;
}

export interface UserCenterStandardAppRouteProjection<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
> {
  mergeContract<TBaseContract extends object>(
    baseContract: TBaseContract,
  ): TBaseContract & Record<UserCenterStandardAppRouteKey, TProjectedRoute>;
  authMode: TAuthMode;
  operationEntries: readonly (readonly [string, UserCenterStandardAppOperationId])[];
  routeRecord: Record<UserCenterStandardAppRouteKey, TProjectedRoute>;
  routes: readonly TProjectedRoute[];
  surface: TSurface;
}

export interface CreateUserCenterStandardAppRouteProjectionOptions<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
> {
  authMode?: TAuthMode;
  formatOperationKey?(route: {
    method: UserCenterRuntimeRequestMethod;
    path: string;
  }): string;
  mapRoute(route: {
    authMode: TAuthMode;
    contractKey: UserCenterStandardAppRouteKey;
    method: UserCenterRuntimeRequestMethod;
    operationId: UserCenterStandardAppOperationId;
    path: string;
    summary: string;
    surface: TSurface;
  }): TProjectedRoute;
  surface?: TSurface;
}

export interface UserCenterCommandMatrixEntry {
  command: string;
  iamMode: string;
  lifecycle: string;
  mode: string;
  providerKind: string;
  surface: string;
}

export declare function createSdkworkCanonicalUserCenterDefinition(
  options: CreateSdkworkCanonicalUserCenterDefinitionOptions,
): SdkworkCanonicalUserCenterDefinition;

export declare function createUserCenterBridgeConfig(
  input: UserCenterBridgeConfigInput,
): UserCenterBridgeConfig;

export declare function createCanonicalUserCenterRuntimeBridge(
  input: CreateCanonicalUserCenterRuntimeBridgeOptions,
): CanonicalUserCenterRuntimeBridge;

export declare function createUserCenterLocalApiRoutes(
  basePath?: string,
): UserCenterLocalApiRoutes;

export declare function createUserCenterRuntimeClient(
  config: UserCenterRuntimeConfig,
  options?: UserCenterRuntimeClientOptions,
): UserCenterRuntimeClient | null;

export declare function createUserCenterSessionStore(
  storage?: UserCenterStorageLike,
): UserCenterTokenStore;

export declare function createUserCenterStandardAppRouteProjection<
  TProjectedRoute,
  TSurface extends string = "app",
  TAuthMode extends string = "user",
>(
  config: UserCenterBridgeConfig,
  options: CreateUserCenterStandardAppRouteProjectionOptions<
    TProjectedRoute,
    TSurface,
    TAuthMode
  >,
): UserCenterStandardAppRouteProjection<TProjectedRoute, TSurface, TAuthMode>;

export declare function createUserCenterStandardTokenHeaders(
  storagePlan: Partial<UserCenterStoragePlan>,
): UserCenterStandardTokenHeaders;

export declare function createUserCenterTokenStore(
  storage?: UserCenterStorageLike,
): UserCenterTokenStore;

export declare function createUserCenterCommandMatrix(): UserCenterCommandMatrixEntry[];

export declare function resolveUserCenterProtectedToken(
  options?: UserCenterProtectedTokenResolutionOptions,
): string | undefined;

export declare function requireUserCenterProtectedToken(
  options?: UserCenterProtectedTokenRequirementOptions,
): string;
