import { useEffect } from "react";
import {
  type SdkworkUserAppearanceConfig,
} from "@sdkwork/user-pc-react";
import {
  createSdkworkCanonicalUserCenterSurfacePage,
  type SdkworkCanonicalUserCenterSurfacePageProps,
  type SdkworkUserCenterUnauthenticatedStateConfig,
} from "@sdkwork/user-center-pc-react";
import { useTranslation } from "react-i18next";
import {
  useAuth,
} from "@sdkwork/birdcoder-commons";
import { createBirdCoderUserCenterController } from "../user-surface.ts";

export type BirdCoderUserCenterUnauthenticatedStateConfig =
  SdkworkUserCenterUnauthenticatedStateConfig;

export interface UserCenterPageProps extends SdkworkCanonicalUserCenterSurfacePageProps {
  appearance?: SdkworkUserAppearanceConfig;
  unauthenticatedState?: BirdCoderUserCenterUnauthenticatedStateConfig;
}

function useBirdCoderUserCenterLocale() {
  return useTranslation().i18n.language;
}

function useBirdCoderUserCenterUser() {
  return useAuth().user;
}

const BirdCoderCanonicalUserCenterPage =
  createSdkworkCanonicalUserCenterSurfacePage({
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
  onAuthenticationRequired,
  ...props
}: UserCenterPageProps = {}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      onAuthenticationRequired?.();
    }
  }, [onAuthenticationRequired, user]);

  return (
    <BirdCoderCanonicalUserCenterPage
      {...props}
      onAuthenticationRequired={onAuthenticationRequired}
    />
  );
}
