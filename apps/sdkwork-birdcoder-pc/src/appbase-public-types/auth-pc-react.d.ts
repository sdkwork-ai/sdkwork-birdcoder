import type { CSSProperties, ReactElement } from "react";

export type SdkworkAuthLoginMethod =
  | "emailCode"
  | "password"
  | "phoneCode"
  | "sessionBridge";

export type SdkworkAuthLeftRailMode =
  | "auto"
  | "highlights-only"
  | "qr-only"
;

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
  verificationCode?: string;
  verificationCodeBypassEnabled?: boolean;
}

export interface SdkworkAuthVerificationPolicyConfig {
  emailCodeLoginEnabled?: boolean;
  emailRegistrationVerificationRequired?: boolean;
  phoneCodeLoginEnabled?: boolean;
  phoneRegistrationVerificationRequired?: boolean;
}

export type SdkworkAuthResolvedVerificationPolicy =
  Required<SdkworkAuthVerificationPolicyConfig>;

export type SdkworkAuthOAuthProviderRegion = "mainland" | "overseas";
export type SdkworkAuthRegisterMethod = "email" | "phone";
export type SdkworkAuthRecoveryMethod = "email" | "phone";

export interface SdkworkAuthRuntimeConfig {
  developmentPrefill?: SdkworkAuthDevelopmentPrefillConfig;
  leftRailMode?: SdkworkAuthLeftRailMode;
  loginMethods?: SdkworkAuthLoginMethod[];
  oauthLoginEnabled?: boolean;
  oauthProviderRegion?: SdkworkAuthOAuthProviderRegion;
  oauthProviders?: string[];
  qrLoginEnabled?: boolean;
  recoveryMethods?: SdkworkAuthRecoveryMethod[];
  registerMethods?: SdkworkAuthRegisterMethod[];
  verificationPolicy?: SdkworkAuthVerificationPolicyConfig;
}

export interface SdkworkAuthControllerState {
  isAuthenticated: boolean;
  isBootstrapped: boolean;
  isBusy: boolean;
  lastError?: string;
  session: SdkworkAuthSession | null;
  status: "anonymous" | "authenticated" | "authenticating";
  user: SdkworkAuthUser | null;
}

export interface SdkworkAuthController {
  applySession(session: SdkworkAuthSession): void;
  bootstrap(): Promise<SdkworkAuthControllerState>;
  getState(): SdkworkAuthControllerState;
  refreshSession(input?: unknown): Promise<SdkworkAuthSession>;
  service: unknown;
  signIn(input: unknown): Promise<SdkworkAuthSession>;
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
  syncUserProfile(user: SdkworkAuthUser | null): void;
  updateCurrentSession(input?: unknown): Promise<SdkworkAuthSession>;
}

export interface SdkworkAuthSlotContainerProps {
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface SdkworkAuthAsideContainerSlotProps extends SdkworkAuthSlotContainerProps {
  presentation: "panel" | "raw";
}

export interface SdkworkAuthHeaderSlotProps extends SdkworkAuthSlotContainerProps {
  badge?: React.ReactNode;
  description: React.ReactNode;
  title: React.ReactNode;
}

export interface SdkworkAuthSurfaceSlots {
  AsideContainer?: React.ComponentType<SdkworkAuthAsideContainerSlotProps>;
  AsidePanel?: React.ComponentType<SdkworkAuthSlotContainerProps>;
  Background?: React.ComponentType<SdkworkAuthSlotContainerProps>;
  Body?: React.ComponentType<SdkworkAuthSlotContainerProps>;
  ContentContainer?: React.ComponentType<SdkworkAuthSlotContainerProps>;
  Header?: React.ComponentType<SdkworkAuthHeaderSlotProps>;
  Page?: React.ComponentType<SdkworkAuthSlotContainerProps>;
  Shell?: React.ComponentType<SdkworkAuthSlotContainerProps>;
}

export interface SdkworkAuthSurfaceSlotProps {
  asideContainer?: Partial<SdkworkAuthAsideContainerSlotProps>;
  asidePanel?: Partial<SdkworkAuthSlotContainerProps>;
  background?: Partial<SdkworkAuthSlotContainerProps>;
  body?: Partial<SdkworkAuthSlotContainerProps>;
  contentContainer?: Partial<SdkworkAuthSlotContainerProps>;
  header?: Partial<SdkworkAuthHeaderSlotProps>;
  page?: Partial<SdkworkAuthSlotContainerProps>;
  shell?: Partial<SdkworkAuthSlotContainerProps>;
}

export interface SdkworkAuthThemeTokens {
  asideCardBackgroundColor?: string;
  asideCardBorderColor?: string;
  asideGlowPrimaryColor?: string;
  asideGlowSecondaryColor?: string;
  asideIconWellBackgroundColor?: string;
  asideIconWellColor?: string;
  asidePanelBackgroundColor?: string;
  asidePanelBorderColor?: string;
  asidePanelColor?: string;
  badgeBackgroundColor?: string;
  badgeTextColor?: string;
  callbackBackgroundColor?: string;
  callbackTextColor?: string;
  contentBackgroundColor?: string;
  contentBorderColor?: string;
  contentTextColor?: string;
  descriptionColor?: string;
  dividerColor?: string;
  fieldBackgroundColor?: string;
  fieldBorderColor?: string;
  fieldPlaceholderColor?: string;
  fieldTextColor?: string;
  formMutedTextColor?: string;
  iconMutedColor?: string;
  labelColor?: string;
  oauthProviderCardActionColor?: string;
  oauthProviderCardBackgroundColor?: string;
  oauthProviderCardBorderColor?: string;
  oauthProviderCardHintColor?: string;
  oauthProviderCardIconBackgroundColor?: string;
  oauthProviderCardIconColor?: string;
  oauthProviderCardTitleColor?: string;
  pageBackgroundColor?: string;
  qrFrameBackgroundColor?: string;
  qrFrameBorderColor?: string;
  shellBackdropFilter?: string;
  shellBackgroundColor?: string;
  shellBorderColor?: string;
  tabActiveBackgroundColor?: string;
  tabActiveTextColor?: string;
  tabBackgroundColor?: string;
  tabInactiveTextColor?: string;
  titleColor?: string;
}

export interface SdkworkAuthAppearanceConfig {
  asideCardClassName?: string;
  asideCardStyle?: CSSProperties;
  asideGlowPrimaryClassName?: string;
  asideGlowPrimaryStyle?: CSSProperties;
  asideGlowSecondaryClassName?: string;
  asideGlowSecondaryStyle?: CSSProperties;
  asideIconWellClassName?: string;
  asideIconWellStyle?: CSSProperties;
  asidePanelClassName?: string;
  asidePanelStyle?: CSSProperties;
  badgeClassName?: string;
  badgeStyle?: CSSProperties;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  callbackHeaderClassName?: string;
  callbackHeaderStyle?: CSSProperties;
  callbackShellClassName?: string;
  callbackShellStyle?: CSSProperties;
  contentContainerClassName?: string;
  contentContainerStyle?: CSSProperties;
  descriptionClassName?: string;
  descriptionStyle?: CSSProperties;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  oauthProviderCardClassName?: string;
  oauthProviderCardStyle?: CSSProperties;
  pageClassName?: string;
  pageStyle?: CSSProperties;
  qrFrameClassName?: string;
  qrFrameStyle?: CSSProperties;
  shellClassName?: string;
  shellStyle?: CSSProperties;
  slotProps?: SdkworkAuthSurfaceSlotProps;
  slots?: SdkworkAuthSurfaceSlots;
  theme?: SdkworkAuthThemeTokens;
  titleClassName?: string;
  titleStyle?: CSSProperties;
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

export interface SdkworkIamRuntimeAuthRuntimeLike {
  contextStore?: {
    clear?: () => Promise<void> | void;
  };
  service: unknown;
  tokenStore?: {
    clear?: () => Promise<void> | void;
    get?: () => Promise<any> | any;
    set?: (session: any) => Promise<void> | void;
  };
}

export interface CreateSdkworkIamRuntimeAuthControllerOptions {
  getRuntime: () =>
    | Promise<SdkworkIamRuntimeAuthRuntimeLike>
    | SdkworkIamRuntimeAuthRuntimeLike;
  initialState?: unknown;
  methodUnavailableMessage?: string;
}

export interface SdkworkIamAuthRoutesProps {
  appearance?: SdkworkAuthAppearanceConfig;
  basePath?: string;
  className?: string;
  controllerOptions?: Omit<CreateSdkworkIamRuntimeAuthControllerOptions, "getRuntime">;
  events?: SdkworkAuthPageEvents;
  getRuntime: () =>
    | Promise<SdkworkIamRuntimeAuthRuntimeLike>
    | SdkworkIamRuntimeAuthRuntimeLike;
  homePath?: string;
  locale?: string | null;
  methodUnavailableMessage?: string;
  routerContextMode?: "auto" | "external" | "none";
  runtimeConfig?: SdkworkAuthRuntimeConfig;
  slots?: SdkworkAuthPageSlots;
  style?: CSSProperties;
  viewportMode?: "fixed" | "flow";
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

export declare function createSdkworkIamRuntimeAuthController(
  options: CreateSdkworkIamRuntimeAuthControllerOptions,
): SdkworkAuthController;

export declare function SdkworkIamAuthRoutes(
  props: SdkworkIamAuthRoutesProps,
): ReactElement | null;

export declare function isSdkworkAuthLeftRailMode(
  value: unknown,
): value is SdkworkAuthLeftRailMode;

export declare function isSdkworkAuthLoginMethod(
  value: unknown,
): value is SdkworkAuthLoginMethod;

export declare function resolveSdkworkAuthDevelopmentPrefill(
  explicitValue?: SdkworkAuthDevelopmentPrefillConfig,
): SdkworkAuthDevelopmentPrefillConfig | undefined;

export declare function resolveSdkworkAuthLoginMethods(
  explicitMethods?: SdkworkAuthLoginMethod[],
  explicitVerificationPolicy?: SdkworkAuthVerificationPolicyConfig,
): SdkworkAuthLoginMethod[];

export declare function resolveSdkworkAuthOAuthProviderRegion(
  explicitRegion?: SdkworkAuthOAuthProviderRegion,
): SdkworkAuthOAuthProviderRegion;

export declare function resolveSdkworkAuthOAuthProviders(
  explicitProviders?: string[],
  explicitRegion?: SdkworkAuthOAuthProviderRegion,
): string[];

export declare function resolveSdkworkAuthRecoveryMethods(
  explicitMethods?: SdkworkAuthRecoveryMethod[],
): SdkworkAuthRecoveryMethod[];

export declare function resolveSdkworkAuthRegisterMethods(
  explicitMethods?: SdkworkAuthRegisterMethod[],
): SdkworkAuthRegisterMethod[];

export declare function resolveSdkworkAuthVerificationPolicy(
  explicitPolicy?: SdkworkAuthVerificationPolicyConfig,
): SdkworkAuthResolvedVerificationPolicy;

export declare function resolveSdkworkAuthRuntimeConfigFromMetadata(
  metadata?: unknown,
): SdkworkAuthRuntimeConfig;

export interface SdkworkSessionAuthBrowserRootProps {
  children?: React.ReactNode;
}

export declare function SdkworkSessionAuthBrowserRoot(
  props: SdkworkSessionAuthBrowserRootProps,
): ReactElement | null;
