import {
  SdkworkIamAuthRoutes,
  type SdkworkIamAuthRoutesProps,
} from "@sdkwork/auth-pc-react";
import { useTranslation } from "react-i18next";
import {
  BIRDCODER_AUTH_BASE_PATH,
} from "../auth.ts";
import {
  resolveBirdCoderAuthAppearance,
  resolveBirdCoderAuthRuntimeConfig,
} from "../auth-surface.ts";

export type AuthPageProps = Omit<
  SdkworkIamAuthRoutesProps,
  | "basePath"
  | "homePath"
  | "locale"
  | "methodUnavailableMessage"
  | "runtimeConfig"
  | "viewportMode"
>;

const BIRDCODER_AUTH_METHOD_UNAVAILABLE_MESSAGE =
  "This BirdCoder sign-in method is temporarily unavailable.";
const BIRDCODER_AUTH_APPEARANCE = resolveBirdCoderAuthAppearance();
const BIRDCODER_AUTH_RUNTIME_CONFIG = resolveBirdCoderAuthRuntimeConfig();

export function AuthPage({ getRuntime, style, ...props }: AuthPageProps) {
  const { i18n } = useTranslation();

  return (
    <SdkworkIamAuthRoutes
      {...props}
      appearance={BIRDCODER_AUTH_APPEARANCE}
      basePath={BIRDCODER_AUTH_BASE_PATH}
      getRuntime={getRuntime}
      homePath="/"
      locale={i18n.language}
      methodUnavailableMessage={BIRDCODER_AUTH_METHOD_UNAVAILABLE_MESSAGE}
      runtimeConfig={BIRDCODER_AUTH_RUNTIME_CONFIG}
      style={{ height: "100%", minHeight: 0, ...style }}
      viewportMode="flow"
    />
  );
}
