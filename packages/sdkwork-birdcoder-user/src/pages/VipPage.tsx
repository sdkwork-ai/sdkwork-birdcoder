import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SdkworkVipPage,
  type SdkworkVipMessagesOverrides,
} from "@sdkwork/vip-pc-react";
import {
  type SdkworkUserAppearanceConfig,
} from "@sdkwork/user-pc-react";
import {
  SdkworkUserCenterProfileSurfacePage,
  type SdkworkUserCenterUnauthenticatedStateConfig,
} from "@sdkwork/user-center-pc-react";
import type { ReactNode } from "react";
import {
  useAuth,
} from "@sdkwork/birdcoder-commons";
import { createBirdCoderVipController } from "../vip-surface.ts";

export interface VipPageProps {
  messages?: SdkworkVipMessagesOverrides;
  onAuthenticationRequired?(): void;
  unauthenticatedAppearance?: SdkworkUserAppearanceConfig;
  unauthenticatedFallback?: ReactNode;
  unauthenticatedState?: SdkworkUserCenterUnauthenticatedStateConfig;
}

export function VipPage({
  messages,
  onAuthenticationRequired,
  unauthenticatedAppearance,
  unauthenticatedFallback,
  unauthenticatedState,
}: VipPageProps = {}) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const controller = useMemo(
    () =>
      createBirdCoderVipController({
        user,
      }),
    [user],
  );

  useEffect(() => {
    if (!user) {
      onAuthenticationRequired?.();
    }
  }, [onAuthenticationRequired, user]);

  if (!user) {
    return (
      <SdkworkUserCenterProfileSurfacePage
        appearance={unauthenticatedAppearance}
        controller={undefined}
        isAuthenticated={false}
        locale={i18n.language}
        onAuthenticationRequired={onAuthenticationRequired}
        unauthenticatedFallback={unauthenticatedFallback}
        unauthenticatedState={unauthenticatedState}
      />
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
