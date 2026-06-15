export type SdkworkCanonicalUserCapability<
  TSourcePackageName extends string = string,
> = {
  routePath: string;
  sourcePackageName: TSourcePackageName;
};

export interface SdkworkCanonicalUserRouteIntent<
  TSourcePackageName extends string = string,
> {
  basePath?: string;
  focusWindow?: boolean;
  group?: string;
  sourcePackageName: TSourcePackageName;
  url: string;
}

export interface SdkworkCanonicalUserSectionRouteIntent<
  TSourcePackageName extends string = string,
> extends SdkworkCanonicalUserRouteIntent<TSourcePackageName> {
  sectionId: string;
}

export interface SdkworkCanonicalUserWorkspaceManifest<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> {
  architecture: TArchitecture;
  bridgePackageName: TBridgePackageName;
  packageNames: readonly string[];
  routePath: string;
  sourcePackageName: TSourcePackageName;
  title: string;
}

export interface CreateSdkworkCanonicalUserDefinitionRouteIntentOptions<
  TSourcePackageName extends string = string,
> {
  basePath?: string;
  focusWindow?: boolean;
  group?: string;
  sourcePackageName?: TSourcePackageName;
}

export interface CreateSdkworkCanonicalUserDefinitionSectionRouteIntentOptions<
  TSourcePackageName extends string = string,
> extends CreateSdkworkCanonicalUserDefinitionRouteIntentOptions<TSourcePackageName> {}

export interface CreateSdkworkCanonicalUserDefinitionWorkspaceManifestOptions {
  routePath?: string;
}

export interface CreateSdkworkCanonicalUserDefinitionOptions<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> {
  architecture: TArchitecture;
  bridgePackageName: TBridgePackageName;
  description?: string;
  host?: string;
  id: string;
  packageNames: readonly string[];
  routePath: string;
  sourcePackageName: TSourcePackageName;
  title: string;
}

export interface SdkworkCanonicalUserDefinition<
  TArchitecture extends string = string,
  TBridgePackageName extends string = string,
  TSourcePackageName extends string = string,
> extends CreateSdkworkCanonicalUserDefinitionOptions<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  > {
  createCapability(
    routePath?: string,
  ): SdkworkCanonicalUserCapability<TSourcePackageName>;
  createRouteIntent(
    options?: CreateSdkworkCanonicalUserDefinitionRouteIntentOptions<TSourcePackageName>,
  ): SdkworkCanonicalUserRouteIntent<TSourcePackageName>;
  createSectionRouteIntent(
    sectionId: string,
    options?: CreateSdkworkCanonicalUserDefinitionSectionRouteIntentOptions<TSourcePackageName>,
  ): SdkworkCanonicalUserSectionRouteIntent<TSourcePackageName>;
  createWorkspaceManifest(
    options?: CreateSdkworkCanonicalUserDefinitionWorkspaceManifestOptions,
  ): SdkworkCanonicalUserWorkspaceManifest<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  >;
}

export interface SdkworkUserPreferences {
  general: Record<string, unknown>;
  notifications: Record<string, unknown>;
  privacy: Record<string, unknown>;
  security: Record<string, unknown>;
}

export interface SdkworkUserProfile {
  avatarUrl?: string;
  displayName?: string;
  email?: string;
  firstName?: string;
  id?: string;
  lastName?: string;
  username?: string;
}

export interface SdkworkUserMessagesOverrides {
  notifications?: {
    description?: string;
  };
  page?: {
    description?: string;
  };
}

export interface SdkworkUserAppearanceConfig {
  className?: string;
  density?: string;
  variant?: string;
}

export interface SdkworkUserService {
  readonly capabilities?: Record<string, unknown>;
}

export interface SdkworkUserController {
  readonly messages?: SdkworkUserMessagesOverrides;
  readonly service?: SdkworkUserService;
}

export interface CreateSdkworkCanonicalUserControllerOptions<
  TUser = unknown,
  TProfileSnapshot = unknown,
> {
  locale?: string | null;
  messageDefaults?: SdkworkUserMessagesOverrides;
  messages?: SdkworkUserMessagesOverrides;
  registry?: unknown;
  service: SdkworkUserService;
  user?: TUser | null;
  profileSnapshot?: TProfileSnapshot;
}

export interface SdkworkCanonicalUserProfileAdapterOptions<
  TUser = unknown,
  TProfileSnapshot = unknown,
> {
  mapUserProfileToSnapshot(
    profile: SdkworkUserProfile,
    currentSnapshot: TProfileSnapshot,
    resolvedUser: TUser,
  ): Promise<TProfileSnapshot> | TProfileSnapshot;
  read(): Promise<TProfileSnapshot>;
  resolveIdentity(
    userSnapshot: TUser,
    profileSnapshot: TProfileSnapshot,
  ): SdkworkUserProfile;
  write(profileSnapshot: TProfileSnapshot): Promise<TProfileSnapshot>;
}

export interface CreateSdkworkCanonicalUserServiceOptions<TUser = unknown> {
  capabilities?: Record<string, unknown>;
  preferences?: {
    defaults: SdkworkUserPreferences;
    key: string;
    read(): Promise<Partial<SdkworkUserPreferences>>;
    write(preferences: Partial<SdkworkUserPreferences>): Promise<SdkworkUserPreferences>;
  };
  profile?: unknown;
  requireAuthenticatedMessage?: string;
  user: TUser | null;
}

export declare function createSdkworkCanonicalUserDefinition<
  TArchitecture extends string,
  TBridgePackageName extends string,
  TSourcePackageName extends string,
>(
  options: CreateSdkworkCanonicalUserDefinitionOptions<
    TArchitecture,
    TBridgePackageName,
    TSourcePackageName
  >,
): SdkworkCanonicalUserDefinition<
  TArchitecture,
  TBridgePackageName,
  TSourcePackageName
>;

export declare function createSdkworkCanonicalUserController<
  TUser = unknown,
  TProfileSnapshot = unknown,
>(
  options: CreateSdkworkCanonicalUserControllerOptions<TUser, TProfileSnapshot>,
): SdkworkUserController;

export declare function createSdkworkCanonicalUserProfileAdapter<
  TUser = unknown,
  TProfileSnapshot = unknown,
>(
  options: SdkworkCanonicalUserProfileAdapterOptions<TUser, TProfileSnapshot>,
): unknown;

export declare function createSdkworkCanonicalUserService<TUser = unknown>(
  options: CreateSdkworkCanonicalUserServiceOptions<TUser>,
): SdkworkUserService;

export declare function resolveSdkworkCanonicalUserDisplayName(
  profile: SdkworkUserProfile,
  fallback?: string,
): string;
