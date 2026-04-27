import { useMemo } from "react";
import {
  mergeSdkworkAuthAppearanceConfigs,
  type SdkworkAuthUser,
} from "@sdkwork/auth-pc-react";
import {
  createSdkworkCanonicalAuthSurfacePage,
  mergeUserCenterSurfaceAppearanceInputs,
  type SdkworkCanonicalAuthSurfacePageProps,
} from "@sdkwork/user-center-pc-react";
import { useTranslation } from "react-i18next";
import {
  useIDEServices,
} from "@sdkwork/birdcoder-commons";
import { BIRDCODER_USER_CENTER_AUTH_BASE_PATH } from "@sdkwork/birdcoder-core";
import type { User } from "@sdkwork/birdcoder-types";
import {
  createBirdCoderAuthController,
  resolveBirdCoderAuthRuntimeConfig,
} from "../auth-surface.ts";
import { useAuth } from "../auth-context.ts";
import {
  useBirdcoderIdentitySurfaceAppearance,
  type BirdcoderIdentityThemeState,
} from "../auth-theme.ts";

export interface AuthPageProps
  extends Omit<SdkworkCanonicalAuthSurfacePageProps, "surfaceAppearance"> {
  surfaceAppearance?: BirdcoderIdentityThemeState["surfaceAppearance"];
}

const BIRDCODER_AUTH_SURFACE_RUNTIME_INVARIANT = Object.freeze({
  // BirdCoder sample requirement:
  // login/register/forgot-password must all keep the QR panel on the left rail.
  // Do not revert this sample to the legacy password/email-code/phone-code cards.
  qrLoginEnabled: true,
});

function mapBirdCoderQrAuthenticatedUser(user: SdkworkAuthUser): User {
  const email = user.email.trim();
  const displayName = user.displayName.trim();
  const username = user.username?.trim() ?? "";
  const fallbackIdentity = email || user.id?.trim() || username;

  return {
    avatarUrl: user.avatarUrl,
    email,
    id: user.id?.trim() || fallbackIdentity,
    name: displayName || username || fallbackIdentity,
  };
}

function useBirdCoderAuthSurfaceService() {
  const {
    adoptAuthenticatedUser,
    exchangeUserCenterSession,
    login,
    logout,
    refreshAuthenticatedUserFromRuntime,
    register,
    signInWithEmailCode,
    signInWithOAuth,
    signInWithPhoneCode,
  } = useAuth();
  const { authService } = useIDEServices();

  return useMemo(
    () => ({
      ...authService,
      checkLoginQrCodeStatus: authService.checkLoginQrCodeStatus
        ? async (...args: Parameters<NonNullable<typeof authService.checkLoginQrCodeStatus>>) => {
            const result = await authService.checkLoginQrCodeStatus!(...args);
            if (result.status === "confirmed" && result.user) {
              await adoptAuthenticatedUser(
                mapBirdCoderQrAuthenticatedUser(result.user),
              );
            } else if (result.status === "confirmed") {
              await refreshAuthenticatedUserFromRuntime();
            }
            return result;
          }
        : undefined,
      exchangeUserCenterSession: authService.exchangeUserCenterSession
        ? async (...args: Parameters<NonNullable<typeof authService.exchangeUserCenterSession>>) => {
            return exchangeUserCenterSession(...args);
          }
        : undefined,
      login: async (...args: Parameters<typeof authService.login>) => {
        return login(...args);
      },
      logout: async (...args: Parameters<typeof authService.logout>) => {
        await logout(...args);
      },
      register: async (...args: Parameters<typeof authService.register>) => {
        return register(...args);
      },
      signInWithEmailCode: authService.signInWithEmailCode
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithEmailCode>>) => {
            return signInWithEmailCode(...args);
          }
        : undefined,
      signInWithOAuth: authService.signInWithOAuth
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithOAuth>>) => {
            return signInWithOAuth(...args);
          }
        : undefined,
      signInWithPhoneCode: authService.signInWithPhoneCode
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithPhoneCode>>) => {
            return signInWithPhoneCode(...args);
          }
        : undefined,
    }),
    [
      adoptAuthenticatedUser,
      authService,
      exchangeUserCenterSession,
      login,
      logout,
      refreshAuthenticatedUserFromRuntime,
      register,
      signInWithEmailCode,
      signInWithOAuth,
      signInWithPhoneCode,
    ],
  );
}

function createBirdCoderAuthServiceExtensions(
  service: ReturnType<typeof useBirdCoderAuthSurfaceService>,
) {
  return {
    ...(service.checkLoginQrCodeStatus
      ? {
          checkLoginQrCodeStatus: service.checkLoginQrCodeStatus,
        }
      : {}),
    ...(service.generateLoginQrCode
      ? {
          generateLoginQrCode: service.generateLoginQrCode,
        }
      : {}),
    ...(service.getOAuthAuthorizationUrl
      ? {
          getOAuthAuthorizationUrl: service.getOAuthAuthorizationUrl,
        }
      : {}),
    ...(service.signInWithOAuth
      ? {
          signInWithOAuth: service.signInWithOAuth,
        }
      : {}),
  };
}

function useBirdCoderAuthConfig() {
  return useAuth().authConfig;
}

function useBirdCoderAuthLocale() {
  return useTranslation().i18n.language;
}

function useBirdCoderAuthService() {
  return useBirdCoderAuthSurfaceService();
}

const BirdCoderCanonicalAuthPage = createSdkworkCanonicalAuthSurfacePage({
  defaultBasePath: BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  defaultHomePath: "/",
  resolveRuntimeConfig: resolveBirdCoderAuthRuntimeConfig,
  useAuthConfig: useBirdCoderAuthConfig,
  useLocale: useBirdCoderAuthLocale,
  useService: useBirdCoderAuthService,
  createController({ authConfig, locale, messages, service }) {
    return createBirdCoderAuthController({
      authConfig,
      locale,
      messages,
      service,
      serviceExtensions: createBirdCoderAuthServiceExtensions(service),
    });
  },
});

export function AuthPage({
  appearance,
  runtimeConfig,
  surfaceAppearance,
  ...props
}: AuthPageProps = {}) {
  const identitySurfaceAppearance = useBirdcoderIdentitySurfaceAppearance();
  const resolvedSurfaceAppearance = useMemo(
    () =>
      mergeUserCenterSurfaceAppearanceInputs(
        identitySurfaceAppearance,
        surfaceAppearance,
      ),
    [identitySurfaceAppearance, surfaceAppearance],
  );
  const resolvedAppearance = useMemo(
    () =>
      mergeSdkworkAuthAppearanceConfigs(
        resolvedSurfaceAppearance?.auth,
        appearance,
      ),
    [appearance, resolvedSurfaceAppearance],
  );
  const resolvedRuntimeConfig = useMemo(
    () => ({
      ...(runtimeConfig ?? {}),
      ...BIRDCODER_AUTH_SURFACE_RUNTIME_INVARIANT,
    }),
    [runtimeConfig],
  );

  return (
    <BirdCoderCanonicalAuthPage
      {...props}
      appearance={resolvedAppearance}
      runtimeConfig={resolvedRuntimeConfig}
      surfaceAppearance={resolvedSurfaceAppearance}
    />
  );
}
