import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SdkworkVipPage,
  type SdkworkVipMessagesOverrides,
} from "@sdkwork/vip-pc-react";
import {
  mergeSdkworkUserAppearanceConfigs,
  type SdkworkUserAppearanceConfig,
} from "@sdkwork/user-pc-react";
import type { ReactNode } from "react";
import {
  useAuth,
  useBirdcoderIdentitySurfaceAppearance,
  type BirdcoderIdentityThemeState,
} from "@sdkwork/birdcoder-commons";
import { createBirdCoderVipController } from "../vip-surface.ts";
import {
  BirdCoderIdentityAccessRequiredState,
  type BirdCoderIdentityAccessRequiredStateConfig,
} from "./IdentityAccessRequiredState.tsx";

export interface VipPageProps {
  messages?: SdkworkVipMessagesOverrides;
  onAuthenticationRequired?(): void;
  surfaceAppearance?: BirdcoderIdentityThemeState["surfaceAppearance"];
  unauthenticatedAppearance?: SdkworkUserAppearanceConfig;
  unauthenticatedFallback?: ReactNode;
  unauthenticatedState?: BirdCoderIdentityAccessRequiredStateConfig;
}

const DEFAULT_BIRDCODER_VIP_UNAUTHENTICATED_STATE: BirdCoderIdentityAccessRequiredStateConfig = {
  badge: "VIP",
  description:
    "Sign in through the unified sdkwork-appbase authentication workflow to review BirdCoder memberships, plans, and renewal options.",
  title: "Sign in to open memberships",
};

export function VipPage({
  messages,
  onAuthenticationRequired,
  surfaceAppearance,
  unauthenticatedAppearance,
  unauthenticatedFallback,
  unauthenticatedState,
}: VipPageProps = {}) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const identitySurfaceAppearance = useBirdcoderIdentitySurfaceAppearance();
  const controller = useMemo(
    () =>
      createBirdCoderVipController({
        user,
      }),
    [user],
  );
  const resolvedUnauthenticatedAppearance = useMemo(
    () =>
      mergeSdkworkUserAppearanceConfigs(
        identitySurfaceAppearance?.user,
        surfaceAppearance?.user,
        unauthenticatedAppearance,
      ),
    [identitySurfaceAppearance, surfaceAppearance, unauthenticatedAppearance],
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
            appearance={resolvedUnauthenticatedAppearance}
            state={unauthenticatedState ?? DEFAULT_BIRDCODER_VIP_UNAUTHENTICATED_STATE}
          />
        )}
      </>
    );
  }

  return (
    <SdkworkVipPage
      controller={controller}
      locale={i18n.language}
      messages={messages}
    />
  );
}
