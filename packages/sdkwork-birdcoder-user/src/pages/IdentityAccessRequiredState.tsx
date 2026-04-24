import type { ReactNode } from "react";
import {
  mergeSdkworkUserClassNames,
  mergeSdkworkUserStyles,
  type SdkworkUserAppearanceConfig,
} from "@sdkwork/user-pc-react";

export interface BirdCoderIdentityAccessRequiredStateConfig {
  action?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}

export function BirdCoderIdentityAccessRequiredState({
  appearance,
  state,
}: {
  appearance?: SdkworkUserAppearanceConfig;
  state?: BirdCoderIdentityAccessRequiredStateConfig;
}) {
  return (
    <div
      className={mergeSdkworkUserClassNames(
        "relative flex min-h-full items-center justify-center bg-[var(--sdk-color-surface-canvas)] px-4 py-4 sm:px-8 sm:py-8",
        appearance?.pageClassName,
      )}
      style={appearance?.pageStyle}
    >
      <div
        className={mergeSdkworkUserClassNames(
          "w-full max-w-3xl rounded-[2rem] border border-[var(--sdk-color-border-default)] bg-[color-mix(in_srgb,var(--sdk-color-surface-panel)_96%,white)] p-4 shadow-[0_28px_80px_rgba(24,24,27,0.10)] sm:p-6",
          appearance?.shellClassName,
        )}
        style={appearance?.shellStyle}
      >
        <section
          className={mergeSdkworkUserClassNames(
            "rounded-[1.75rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-6 py-6 shadow-[var(--sdk-shadow-sm)] sm:px-8 sm:py-8",
            appearance?.heroPanelClassName,
          )}
          style={appearance?.heroPanelStyle}
        >
          <div
            className={mergeSdkworkUserClassNames(
              "inline-flex rounded-full border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel-muted)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--sdk-color-brand-primary)]",
              appearance?.heroBadgeClassName,
            )}
            style={appearance?.heroBadgeStyle}
          >
            {state?.badge ?? "Identity"}
          </div>
          <h2
            className={mergeSdkworkUserClassNames(
              "mt-5 text-3xl font-semibold tracking-tight text-[var(--sdk-color-text-primary)] sm:text-4xl",
              appearance?.heroTitleClassName,
            )}
            style={appearance?.heroTitleStyle}
          >
            {state?.title ?? "Authentication required"}
          </h2>
          <p
            className={mergeSdkworkUserClassNames(
              "mt-3 max-w-2xl text-sm leading-7 text-[var(--sdk-color-text-secondary)]",
              appearance?.heroDescriptionClassName,
            )}
            style={mergeSdkworkUserStyles(appearance?.heroDescriptionStyle)}
          >
            {state?.description
              ?? "Sign in through the unified sdkwork-appbase authentication workflow to continue."}
          </p>
          {state?.action ? <div className="mt-6">{state.action}</div> : null}
        </section>
      </div>
    </div>
  );
}
