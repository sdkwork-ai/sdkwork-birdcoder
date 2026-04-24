import { useMemo } from "react";
import {
  mergeSdkworkAuthAppearanceConfigs,
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

function useBirdCoderAuthSurfaceService() {
  const { refreshCurrentUser } = useAuth();
  const { authService } = useIDEServices();

  return useMemo(
    () => ({
      ...authService,
      checkLoginQrCodeStatus: authService.checkLoginQrCodeStatus
        ? async (...args: Parameters<NonNullable<typeof authService.checkLoginQrCodeStatus>>) => {
            const result = await authService.checkLoginQrCodeStatus!(...args);
            if (result.status === "confirmed") {
              await refreshCurrentUser();
            }
            return result;
          }
        : undefined,
      exchangeUserCenterSession: authService.exchangeUserCenterSession
        ? async (...args: Parameters<NonNullable<typeof authService.exchangeUserCenterSession>>) => {
            const user = await authService.exchangeUserCenterSession!(...args);
            await refreshCurrentUser();
            return user;
          }
        : undefined,
      login: async (...args: Parameters<typeof authService.login>) => {
        const user = await authService.login(...args);
        await refreshCurrentUser();
        return user;
      },
      logout: async (...args: Parameters<typeof authService.logout>) => {
        await authService.logout(...args);
        await refreshCurrentUser();
      },
      register: async (...args: Parameters<typeof authService.register>) => {
        const user = await authService.register(...args);
        await refreshCurrentUser();
        return user;
      },
      signInWithEmailCode: authService.signInWithEmailCode
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithEmailCode>>) => {
            const user = await authService.signInWithEmailCode!(...args);
            await refreshCurrentUser();
            return user;
          }
        : undefined,
      signInWithOAuth: authService.signInWithOAuth
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithOAuth>>) => {
            const user = await authService.signInWithOAuth!(...args);
            await refreshCurrentUser();
            return user;
          }
        : undefined,
      signInWithPhoneCode: authService.signInWithPhoneCode
        ? async (...args: Parameters<NonNullable<typeof authService.signInWithPhoneCode>>) => {
            const user = await authService.signInWithPhoneCode!(...args);
            await refreshCurrentUser();
            return user;
          }
        : undefined,
    }),
    [authService, refreshCurrentUser],
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
