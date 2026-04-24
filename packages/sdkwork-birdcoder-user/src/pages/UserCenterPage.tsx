import { useEffect, useMemo } from "react";
import {
  mergeSdkworkUserAppearanceConfigs,
  type SdkworkUserAppearanceConfig,
} from "@sdkwork/user-pc-react";
import {
  createSdkworkCanonicalUserCenterSurfacePage,
  mergeUserCenterSurfaceAppearanceInputs,
  type SdkworkCanonicalUserCenterSurfacePageProps,
} from "@sdkwork/user-center-pc-react";
import { useTranslation } from "react-i18next";
import {
  useAuth,
  useBirdcoderIdentitySurfaceAppearance,
  type BirdcoderIdentityThemeState,
} from "@sdkwork/birdcoder-commons";
import { createBirdCoderUserCenterController } from "../user-surface.ts";
import {
  BirdCoderIdentityAccessRequiredState,
  type BirdCoderIdentityAccessRequiredStateConfig,
} from "./IdentityAccessRequiredState.tsx";

export type BirdCoderUserCenterUnauthenticatedStateConfig =
  BirdCoderIdentityAccessRequiredStateConfig;

export interface UserCenterPageProps
  extends Omit<SdkworkCanonicalUserCenterSurfacePageProps, "surfaceAppearance"> {
  appearance?: SdkworkUserAppearanceConfig;
  surfaceAppearance?: BirdcoderIdentityThemeState["surfaceAppearance"];
  unauthenticatedState?: BirdCoderUserCenterUnauthenticatedStateConfig;
}

const DEFAULT_BIRDCODER_USER_CENTER_UNAUTHENTICATED_STATE: BirdCoderUserCenterUnauthenticatedStateConfig =
  {
    badge: "User Center",
    description:
      "Sign in through the unified sdkwork-appbase authentication workflow to access your shared BirdCoder profile and preferences.",
    title: "Sign in to open the user center",
  };

function useBirdCoderUserCenterLocale() {
  return useTranslation().i18n.language;
}

function useBirdCoderUserCenterUser() {
  return useAuth().user;
}

const BirdCoderCanonicalUserCenterPage =
  createSdkworkCanonicalUserCenterSurfacePage({
    defaultUnauthenticatedState: DEFAULT_BIRDCODER_USER_CENTER_UNAUTHENTICATED_STATE,
    useLocale: useBirdCoderUserCenterLocale,
    useUser: useBirdCoderUserCenterUser,
    createController({ locale, messages, user }) {
      return createBirdCoderUserCenterController({
        locale,
        messages,
        user,
      });
    },
  });

export function UserCenterPage({
  appearance,
  onAuthenticationRequired,
  surfaceAppearance,
  unauthenticatedFallback,
  unauthenticatedState,
  ...props
}: UserCenterPageProps = {}) {
  const { user } = useAuth();
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
      mergeSdkworkUserAppearanceConfigs(
        resolvedSurfaceAppearance?.user,
        appearance,
      ),
    [appearance, resolvedSurfaceAppearance],
  );

  useEffect(() => {
    if (!user) {
      onAuthenticationRequired?.();
    }
  }, [onAuthenticationRequired, user]);

  if (!user) {
    return (
      <>
        {unauthenticatedFallback ?? (
          <BirdCoderIdentityAccessRequiredState
            appearance={resolvedAppearance}
            state={
              unauthenticatedState ?? DEFAULT_BIRDCODER_USER_CENTER_UNAUTHENTICATED_STATE
            }
          />
        )}
      </>
    );
  }

  return (
    <BirdCoderCanonicalUserCenterPage
      {...props}
      appearance={resolvedAppearance}
      onAuthenticationRequired={onAuthenticationRequired}
      surfaceAppearance={resolvedSurfaceAppearance}
      unauthenticatedFallback={unauthenticatedFallback}
      unauthenticatedState={
        unauthenticatedState ?? DEFAULT_BIRDCODER_USER_CENTER_UNAUTHENTICATED_STATE
      }
    />
  );
}
