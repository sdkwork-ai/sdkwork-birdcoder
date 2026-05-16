import type { ComponentType, ReactNode } from "react";

export interface SdkworkCanonicalAuthSurfacePageProps {
  className?: string;
  defaultBasePath?: string;
  defaultHomePath?: string;
}

export interface SdkworkCanonicalAuthSurfacePageFactoryOptions<
  TAuthConfig = unknown,
  TService = unknown,
> {
  createController(input: {
    authConfig?: TAuthConfig | null;
    service: TService;
  }): unknown;
  defaultBasePath?: string;
  defaultHomePath?: string;
  resolveRuntimeConfig?(authConfig?: TAuthConfig | null): unknown;
  useAuthConfig(): TAuthConfig | null | undefined;
  useService(): TService;
}

export interface SdkworkCanonicalUserCenterSurfacePageProps {
  className?: string;
  onAuthenticationRequired?(): void;
}

export interface SdkworkUserCenterUnauthenticatedStateConfig {
  actionLabel?: string;
  description?: string;
  title?: string;
}

export interface SdkworkCanonicalUserCenterSurfacePageFactoryOptions<
  TUser = unknown,
> {
  createController(input: {
    locale?: string | null;
    messages?: unknown;
    user: TUser | null;
  }): unknown;
  useLocale(): string;
  useUser(): TUser | null;
}

export interface SdkworkUserCenterProfileSurfacePageProps {
  appearance?: unknown;
  controller?: unknown;
  isAuthenticated?: boolean;
  locale?: string;
  onAuthenticationRequired?(): void;
  unauthenticatedFallback?: ReactNode;
  unauthenticatedState?: SdkworkUserCenterUnauthenticatedStateConfig;
}

export declare const SdkworkUserCenterProfileSurfacePage: ComponentType<
  SdkworkUserCenterProfileSurfacePageProps
>;

export declare function createSdkworkCanonicalAuthSurfacePage<
  TAuthConfig = unknown,
  TService = unknown,
>(
  options: SdkworkCanonicalAuthSurfacePageFactoryOptions<TAuthConfig, TService>,
): ComponentType<SdkworkCanonicalAuthSurfacePageProps>;

export declare function createSdkworkCanonicalUserCenterSurfacePage<
  TUser = unknown,
>(
  options: SdkworkCanonicalUserCenterSurfacePageFactoryOptions<TUser>,
): ComponentType<SdkworkCanonicalUserCenterSurfacePageProps>;
