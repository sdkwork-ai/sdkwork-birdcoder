export type SdkworkAuthLoginMethod =
  | "emailCode"
  | "oauth"
  | "password"
  | "phoneCode"
  | "qrCode"
  | "sessionBridge";

export type SdkworkAuthLeftRailMode =
  | "hidden"
  | "oauth-only"
  | "qr-only"
  | "standard";

export type SdkworkAuthRouteId =
  | "login"
  | "oauthCallback"
  | "recover"
  | "register";

export interface SdkworkAuthUser {
  avatarUrl?: string;
  displayName: string;
  email: string;
  firstName: string;
  id?: string;
  initials: string;
  lastName: string;
  username?: string;
}

export interface SdkworkAuthSession {
  accessToken: string;
  authToken: string;
  refreshToken?: string;
  user?: SdkworkAuthUser;
}

export interface SdkworkAuthDevelopmentPrefillConfig {
  account?: string;
  email?: string;
  enabled?: boolean;
  loginMethod?: SdkworkAuthLoginMethod;
  password?: string;
  phone?: string;
}

export interface SdkworkAuthRuntimeConfig {
  developmentPrefill?: SdkworkAuthDevelopmentPrefillConfig;
  enabledLoginMethods?: readonly SdkworkAuthLoginMethod[];
  leftRailMode?: SdkworkAuthLeftRailMode;
  oauthProviders?: readonly string[];
  registerEnabled?: boolean;
  resetPasswordEnabled?: boolean;
}

export interface SdkworkAuthAppearanceConfig {
  className?: string;
  variant?: string;
}

export interface SdkworkAuthPageEvents {
  onAuthenticationRequired?(): void;
  onAuthenticated?(session: SdkworkAuthSession): void;
}

export interface SdkworkAuthPageSlots {
  footer?: unknown;
  header?: unknown;
}

export interface SdkworkCanonicalAuthRouteDefinition<
  TSourcePackageName extends string = string,
> {
  id: SdkworkAuthRouteId;
  path: string;
  sourcePackageName: TSourcePackageName;
  title: string;
}

export interface SdkworkCanonicalAuthRouteIntent<
  TSourcePackageName extends string = string,
> {
  basePath: string;
  focusWindow?: boolean;
  group?: string;
  routeId: SdkworkAuthRouteId;
  sourcePackageName: TSourcePackageName;
  url: string;
}

export interface SdkworkCanonicalAuthWorkspaceManifest<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> {
  architecture: TArchitecture;
  bridgePackageName: TBridgePackageName;
  packageNames: readonly string[];
  routes: readonly SdkworkCanonicalAuthRouteDefinition<TSourcePackageName>[];
  sourcePackageName: TSourcePackageName;
  title: string;
}

export interface CreateSdkworkCanonicalAuthDefinitionRouteIntentOptions<
  TSourcePackageName extends string = string,
> {
  basePath?: string;
  focusWindow?: boolean;
  group?: string;
  sourcePackageName?: TSourcePackageName;
}

export interface CreateSdkworkCanonicalAuthDefinitionWorkspaceManifestOptions {
  basePath?: string;
}

export interface CreateSdkworkCanonicalAuthDefinitionOptions<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> {
  architecture: TArchitecture;
  basePath: string;
  bridgePackageName: TBridgePackageName;
  description?: string;
  host?: string;
  id: string;
  packageNames: readonly string[];
  sourcePackageName: TSourcePackageName;
  title: string;
}

export interface SdkworkCanonicalAuthDefinition<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> extends CreateSdkworkCanonicalAuthDefinitionOptions<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  > {
  createRouteCatalog(
    basePath?: string,
  ): SdkworkCanonicalAuthRouteDefinition<TSourcePackageName>[];
  createRouteIntent(
    routeId: SdkworkAuthRouteId,
    options?: CreateSdkworkCanonicalAuthDefinitionRouteIntentOptions<TSourcePackageName>,
  ): SdkworkCanonicalAuthRouteIntent<TSourcePackageName>;
  createWorkspaceManifest(
    options?: CreateSdkworkCanonicalAuthDefinitionWorkspaceManifestOptions,
  ): SdkworkCanonicalAuthWorkspaceManifest<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  >;
}

export interface SdkworkAuthServiceLike<TUser = unknown, TAuthConfig = unknown> {
  exchangeUserCenterSession?(request: unknown): Promise<TUser>;
  getCurrentUser(): Promise<TUser | null>;
  getUserCenterConfig?(): Promise<TAuthConfig | null>;
  login(request: unknown, password?: string): Promise<TUser>;
  logout(): Promise<void>;
  register(request: unknown, password?: string, name?: string): Promise<TUser>;
  requestPasswordReset?(request: unknown): Promise<void>;
  resetPassword?(request: unknown): Promise<void>;
  sendVerifyCode?(request: unknown): Promise<void>;
  signInWithEmailCode?(request: unknown): Promise<TUser>;
  signInWithOAuth?(input: unknown): Promise<TUser>;
  signInWithPhoneCode?(request: unknown): Promise<TUser>;
}

export interface CreateSdkworkCanonicalAuthControllerOptions<
  TUser = unknown,
  TAuthConfig = unknown,
> {
  authConfig?: TAuthConfig | null;
  resolveSessionBridgeProviderKey?(authConfig?: TAuthConfig | null): string | undefined;
  resolveSyntheticSessionKey?(user: TUser): string;
  service: SdkworkAuthServiceLike<TUser, TAuthConfig>;
  serviceExtensions?: Record<string, unknown>;
  toSession(user: TUser): SdkworkAuthSession;
  toUser(user: TUser): SdkworkAuthUser;
}

export interface SdkworkAuthController {
  readonly config?: SdkworkAuthRuntimeConfig;
  readonly service?: unknown;
}

export declare function createSdkworkCanonicalAuthDefinition<
  TArchitecture extends string,
  TBridgePackageName extends string,
  TSourcePackageName extends string,
>(
  options: CreateSdkworkCanonicalAuthDefinitionOptions<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  >,
): SdkworkCanonicalAuthDefinition<
  TArchitecture,
  TBridgePackageName,
  TSourcePackageName
>;

export declare function createSdkworkAuthUserFromCanonicalIdentity(input: {
  avatarUrl?: string;
  email?: string;
  id?: string;
  name?: string;
  username?: string;
}): SdkworkAuthUser;

export declare function createSdkworkCanonicalAuthController<
  TUser = unknown,
  TAuthConfig = unknown,
>(
  options: CreateSdkworkCanonicalAuthControllerOptions<TUser, TAuthConfig>,
): SdkworkAuthController;

export declare function createSdkworkSyntheticAuthSession(
  user: SdkworkAuthUser,
  options?: {
    accessToken?: string;
    authToken?: string;
    refreshToken?: string;
    sessionKey?: string;
  },
): SdkworkAuthSession;

export declare function isSdkworkAuthLeftRailMode(
  value: unknown,
): value is SdkworkAuthLeftRailMode;

export declare function isSdkworkAuthLoginMethod(
  value: unknown,
): value is SdkworkAuthLoginMethod;

export declare function resolveSdkworkAuthRuntimeConfigFromMetadata(
  metadata?: unknown,
): SdkworkAuthRuntimeConfig;
