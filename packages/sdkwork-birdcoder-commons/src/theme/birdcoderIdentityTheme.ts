import { useEffect, useMemo, useState } from "react";
import type { UserCenterSurfaceAppearanceInput } from "@sdkwork/user-center-pc-react";
import { useBirdcoderAppSettings } from "../hooks/useBirdcoderAppSettings.ts";
import type { AppSettings } from "../settings/appSettings.ts";

interface RgbColor {
  blue: number;
  green: number;
  red: number;
}

const THEME_COLOR_SWATCHES: Record<SdkworkThemeColor, string> = {
  "green-tech": "#10b981",
  lobster: "#ef4444",
  rose: "#f43f5e",
  "tech-blue": "#2563eb",
  violet: "#8b5cf6",
  zinc: "#52525b",
};

type SdkworkColorMode = "dark" | "light";
type SdkworkThemeColor =
  | "green-tech"
  | "lobster"
  | "rose"
  | "tech-blue"
  | "violet"
  | "zinc";
type SdkworkThemeSelection = SdkworkColorMode | "system";

export interface BirdcoderIdentityThemeState {
  codeFontFamily: string;
  codeFontSize: string;
  colorMode: SdkworkColorMode;
  hostStyle: Record<string, string>;
  surfaceAppearance: UserCenterSurfaceAppearanceInput;
  themeColor: SdkworkThemeColor;
  themeSelection: SdkworkThemeSelection;
  uiFontFamily: string;
  uiFontSize: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim() || "";
  if (/^#[0-9a-fA-F]{6}$/.test(normalizedValue)) {
    return normalizedValue.toUpperCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(normalizedValue)) {
    const red = normalizedValue[1];
    const green = normalizedValue[2];
    const blue = normalizedValue[3];
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
  }

  return fallback.toUpperCase();
}

function parseHexColor(value: string, fallback: string): RgbColor {
  const normalizedValue = normalizeHexColor(value, fallback).slice(1);
  return {
    blue: Number.parseInt(normalizedValue.slice(4, 6), 16),
    green: Number.parseInt(normalizedValue.slice(2, 4), 16),
    red: Number.parseInt(normalizedValue.slice(0, 2), 16),
  };
}

function formatHexColor(color: RgbColor): string {
  const serialize = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${serialize(color.red)}${serialize(color.green)}${serialize(color.blue)}`.toUpperCase();
}

function formatRgbaColor(color: RgbColor, alpha: number): string {
  const resolvedAlpha = clamp(alpha, 0, 1);
  return `rgba(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)}, ${resolvedAlpha.toFixed(3)})`;
}

function mixHexColors(
  startColor: string,
  endColor: string,
  ratio: number,
  fallback: string,
): string {
  const resolvedRatio = clamp(ratio, 0, 1);
  const left = parseHexColor(startColor, fallback);
  const right = parseHexColor(endColor, fallback);
  return formatHexColor({
    blue: left.blue + (right.blue - left.blue) * resolvedRatio,
    green: left.green + (right.green - left.green) * resolvedRatio,
    red: left.red + (right.red - left.red) * resolvedRatio,
  });
}

function createAlphaColor(
  color: string,
  alpha: number,
  fallback: string,
): string {
  return formatRgbaColor(parseHexColor(color, fallback), alpha);
}

function createThemeScale(baseColor: string): Record<string, string> {
  return {
    "50": mixHexColors(baseColor, "#FFFFFF", 0.92, baseColor),
    "100": mixHexColors(baseColor, "#FFFFFF", 0.84, baseColor),
    "200": mixHexColors(baseColor, "#FFFFFF", 0.68, baseColor),
    "300": mixHexColors(baseColor, "#FFFFFF", 0.50, baseColor),
    "400": mixHexColors(baseColor, "#FFFFFF", 0.24, baseColor),
    "500": normalizeHexColor(baseColor, baseColor),
    "600": mixHexColors(baseColor, "#09090B", 0.12, baseColor),
    "700": mixHexColors(baseColor, "#09090B", 0.24, baseColor),
    "800": mixHexColors(baseColor, "#09090B", 0.38, baseColor),
    "900": mixHexColors(baseColor, "#09090B", 0.52, baseColor),
    "950": mixHexColors(baseColor, "#09090B", 0.68, baseColor),
  };
}

function resolveRelativeLuminance(color: string, fallback: string): number {
  const rgb = parseHexColor(color, fallback);
  const normalizeChannel = (value: number) => {
    const ratio = clamp(value / 255, 0, 1);
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * normalizeChannel(rgb.red)
    + 0.7152 * normalizeChannel(rgb.green)
    + 0.0722 * normalizeChannel(rgb.blue);
}

function resolveReadableTextColor(
  backgroundColor: string,
  lightTextColor = "#FFFFFF",
  darkTextColor = "#09090B",
): string {
  return resolveRelativeLuminance(backgroundColor, darkTextColor) > 0.45
    ? darkTextColor
    : lightTextColor;
}

function resolveThemeSelection(theme: string | null | undefined): SdkworkThemeSelection {
  const normalizedTheme = theme?.trim().toLowerCase();
  if (normalizedTheme === "light") {
    return "light";
  }

  if (normalizedTheme === "dark") {
    return "dark";
  }

  return "system";
}

function resolveThemeColorFromName(
  themeName: string | null | undefined,
): SdkworkThemeColor | null {
  const normalizedThemeName = themeName?.trim().toLowerCase() || "";
  if (!normalizedThemeName) {
    return null;
  }

  if (normalizedThemeName.includes("dracula") || normalizedThemeName.includes("violet")) {
    return "violet";
  }

  if (normalizedThemeName.includes("solarized")) {
    return "green-tech";
  }

  if (normalizedThemeName.includes("github") || normalizedThemeName.includes("codex")) {
    return "tech-blue";
  }

  return null;
}

function resolveThemeColorFromAccent(accentColor: string): SdkworkThemeColor {
  const accent = parseHexColor(accentColor, THEME_COLOR_SWATCHES["tech-blue"]);
  let resolvedThemeColor: SdkworkThemeColor = "tech-blue";
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const [themeColor, swatch] of Object.entries(THEME_COLOR_SWATCHES) as Array<[SdkworkThemeColor, string]>) {
    const candidate = parseHexColor(swatch, swatch);
    const distance =
      (accent.red - candidate.red) ** 2
      + (accent.green - candidate.green) ** 2
      + (accent.blue - candidate.blue) ** 2;
    if (distance < smallestDistance) {
      smallestDistance = distance;
      resolvedThemeColor = themeColor;
    }
  }

  return resolvedThemeColor;
}

function resolveSystemColorMode(): SdkworkColorMode {
  if (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

function useSystemColorMode(): SdkworkColorMode {
  const [colorMode, setColorMode] = useState<SdkworkColorMode>(() => resolveSystemColorMode());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const syncColorMode = (event?: MediaQueryListEvent | MediaQueryList) => {
      const matches = event ? event.matches : mediaQuery.matches;
      setColorMode(matches ? "light" : "dark");
    };

    syncColorMode(mediaQuery);
    mediaQuery.addEventListener?.("change", syncColorMode);
    mediaQuery.addListener?.(syncColorMode);

    return () => {
      mediaQuery.removeEventListener?.("change", syncColorMode);
      mediaQuery.removeListener?.(syncColorMode);
    };
  }, []);

  return colorMode;
}

export function resolveBirdcoderIdentityThemeState(
  settings: AppSettings,
  systemColorMode: SdkworkColorMode = "dark",
): BirdcoderIdentityThemeState {
  const themeSelection = resolveThemeSelection(settings.theme);
  const colorMode = themeSelection === "system" ? systemColorMode : themeSelection;
  const isDarkMode = colorMode === "dark";
  const accentColor = normalizeHexColor(
    isDarkMode ? settings.darkAccent : settings.lightAccent,
    isDarkMode ? "#339CFF" : "#0285FF",
  );
  const backgroundColor = normalizeHexColor(
    isDarkMode ? settings.darkBackground : settings.lightBackground,
    isDarkMode ? "#181818" : "#FFFFFF",
  );
  const foregroundColor = normalizeHexColor(
    isDarkMode ? settings.darkForeground : settings.lightForeground,
    isDarkMode ? "#FFFFFF" : "#0D0D0D",
  );
  const uiFontFamily = (isDarkMode ? settings.darkUiFont : settings.lightUiFont)?.trim()
    || "-apple-system, BlinkMacSystemFont";
  const codeFontFamily = (isDarkMode ? settings.darkCodeFont : settings.lightCodeFont)?.trim()
    || "ui-monospace, SFMono-Regular";
  const uiFontSize = settings.uiFontSize?.trim() || "13";
  const codeFontSize = settings.codeFontSize?.trim() || "12";
  const contrastValue = clamp(
    Number.isFinite(isDarkMode ? settings.darkContrast : settings.lightContrast)
      ? Number(isDarkMode ? settings.darkContrast : settings.lightContrast)
      : (isDarkMode ? 60 : 45),
    0,
    100,
  );
  const translucent = isDarkMode ? settings.darkTranslucent !== false : settings.lightTranslucent !== false;
  const themeName = isDarkMode ? settings.darkThemeName : settings.lightThemeName;
  const themeColor =
    resolveThemeColorFromName(themeName)
    ?? resolveThemeColorFromAccent(accentColor);
  const canvasSurface = backgroundColor;
  const panelLiftRatio = isDarkMode
    ? 0.08 + (contrastValue / 100) * 0.10
    : 0.02 + (contrastValue / 100) * 0.08;
  const mutedSurface = mixHexColors(canvasSurface, foregroundColor, panelLiftRatio * 1.25, canvasSurface);
  const elevatedSurface = mixHexColors(canvasSurface, foregroundColor, panelLiftRatio * 1.75, canvasSurface);
  const shellSurface = mixHexColors(canvasSurface, foregroundColor, panelLiftRatio, canvasSurface);
  const emphasisSurface = isDarkMode
    ? mixHexColors(canvasSurface, "#000000", 0.18, canvasSurface)
    : mixHexColors(canvasSurface, foregroundColor, 0.09, canvasSurface);
  const secondaryTextColor = mixHexColors(foregroundColor, canvasSurface, isDarkMode ? 0.24 : 0.34, foregroundColor);
  const mutedTextColor = mixHexColors(foregroundColor, canvasSurface, isDarkMode ? 0.48 : 0.56, foregroundColor);
  const badgeTextColor = resolveReadableTextColor(accentColor);
  const borderSubtleColor = createAlphaColor(foregroundColor, isDarkMode ? 0.08 : 0.06, foregroundColor);
  const borderDefaultColor = createAlphaColor(foregroundColor, isDarkMode ? 0.14 : 0.10, foregroundColor);
  const borderStrongColor = createAlphaColor(foregroundColor, isDarkMode ? 0.18 : 0.14, foregroundColor);
  const shellBackgroundColor = translucent
    ? createAlphaColor(shellSurface, isDarkMode ? 0.88 : 0.92, shellSurface)
    : shellSurface;
  const authPageBackgroundColor = isDarkMode
    ? mixHexColors(canvasSurface, "#000000", 0.18, canvasSurface)
    : mixHexColors(canvasSurface, "#FFFFFF", 0.02, canvasSurface);
  const authShellSurface = isDarkMode
    ? mixHexColors(canvasSurface, foregroundColor, panelLiftRatio * 0.7, canvasSurface)
    : mixHexColors(canvasSurface, foregroundColor, panelLiftRatio * 0.9, canvasSurface);
  const authShellBackgroundColor = translucent
    ? createAlphaColor(authShellSurface, isDarkMode ? 0.84 : 0.94, authShellSurface)
    : authShellSurface;
  const authAsideSurface = isDarkMode
    ? mixHexColors(authShellSurface, "#000000", 0.16, authShellSurface)
    : emphasisSurface;
  const authCardSurface = isDarkMode
    ? mixHexColors(authAsideSurface, foregroundColor, 0.06, authAsideSurface)
    : authShellSurface;
  const authCardBackgroundColor = translucent
    ? createAlphaColor(authCardSurface, isDarkMode ? 0.90 : 0.70, authCardSurface)
    : authCardSurface;
  const authAsidePanelBackgroundColor = translucent
    ? createAlphaColor(authAsideSurface, isDarkMode ? 0.94 : 0.96, authAsideSurface)
    : authAsideSurface;
  const qrFrameBackgroundColor = translucent
    ? createAlphaColor(mutedSurface, isDarkMode ? 0.74 : 0.86, mutedSurface)
    : mutedSurface;
  const authQrFrameBackgroundColor = translucent
    ? createAlphaColor(authCardSurface, isDarkMode ? 0.96 : 0.88, authCardSurface)
    : authCardSurface;
  const oauthCardBackgroundColor = translucent
    ? createAlphaColor(mutedSurface, isDarkMode ? 0.84 : 0.94, mutedSurface)
    : mutedSurface;
  const authOauthCardBackgroundColor = translucent
    ? createAlphaColor(mutedSurface, isDarkMode ? 0.76 : 0.94, mutedSurface)
    : mutedSurface;
  const iconWellBackgroundColor = isDarkMode
    ? createAlphaColor(authCardSurface, 0.98, authCardSurface)
    : createAlphaColor(accentColor, 0.12, accentColor);
  const iconWellColor = isDarkMode ? "#FFFFFF" : accentColor;
  const badgeBackgroundColor = createAlphaColor(accentColor, isDarkMode ? 0.18 : 0.12, accentColor);
  const brandAccentColor = mixHexColors(
    accentColor,
    foregroundColor,
    isDarkMode ? 0.18 : 0.06,
    accentColor,
  );
  const brandPrimaryHoverColor = mixHexColors(
    accentColor,
    isDarkMode ? "#FFFFFF" : "#09090B",
    isDarkMode ? 0.12 : 0.16,
    accentColor,
  );
  const brandPrimarySoftColor = createAlphaColor(
    accentColor,
    isDarkMode ? 0.18 : 0.12,
    accentColor,
  );
  const surfaceOverlayColor = createAlphaColor(
    canvasSurface,
    isDarkMode ? 0.56 : 0.20,
    canvasSurface,
  );
  const shadowSoft = `0 4px 16px ${createAlphaColor(canvasSurface, isDarkMode ? 0.10 : 0.06, canvasSurface)}`;
  const shadowSm = `0 8px 24px ${createAlphaColor(canvasSurface, isDarkMode ? 0.16 : 0.08, canvasSurface)}`;
  const shadowMd = `0 18px 50px ${createAlphaColor(canvasSurface, isDarkMode ? 0.22 : 0.12, canvasSurface)}`;
  const shadowLg = `0 32px 80px ${createAlphaColor(canvasSurface, isDarkMode ? 0.28 : 0.18, canvasSurface)}`;
  const authGlowPrimaryColor = createAlphaColor(accentColor, isDarkMode ? 0.10 : 0.08, accentColor);
  const authGlowSecondaryBaseColor = isDarkMode
    ? mixHexColors(authPageBackgroundColor, "#000000", 0.22, authPageBackgroundColor)
    : elevatedSurface;
  const authGlowSecondaryColor = createAlphaColor(
    authGlowSecondaryBaseColor,
    isDarkMode ? 0.74 : 0.72,
    authGlowSecondaryBaseColor,
  );
  const authContentSurface = isDarkMode
    ? mixHexColors(authShellSurface, foregroundColor, 0.04, authShellSurface)
    : mixHexColors(authShellSurface, "#FFFFFF", 0.18, authShellSurface);
  const authContentPanelBackgroundColor = translucent
    ? createAlphaColor(authContentSurface, isDarkMode ? 0.78 : 0.84, authContentSurface)
    : authContentSurface;
  const authDividerColor = createAlphaColor(
    foregroundColor,
    isDarkMode ? 0.05 : 0.06,
    foregroundColor,
  );
  const authInsetHighlightColor = createAlphaColor(
    foregroundColor,
    isDarkMode ? 0.035 : 0.025,
    foregroundColor,
  );
  const authShellShadow = `0 24px 64px ${createAlphaColor(canvasSurface, isDarkMode ? 0.18 : 0.10, canvasSurface)}`;
  const themeScale = createThemeScale(accentColor);
  const hostStyle = {
    "--sdk-color-brand-accent": brandAccentColor,
    "--sdk-color-brand-primary": accentColor,
    "--sdk-color-brand-primary-hover": brandPrimaryHoverColor,
    "--sdk-color-brand-primary-soft": brandPrimarySoftColor,
    "--sdk-color-border-default": borderDefaultColor,
    "--sdk-color-border-focus": createAlphaColor(accentColor, isDarkMode ? 0.44 : 0.38, accentColor),
    "--sdk-color-border-strong": borderStrongColor,
    "--sdk-color-border-subtle": borderSubtleColor,
    "--sdk-color-surface-canvas": canvasSurface,
    "--sdk-color-surface-elevated": elevatedSurface,
    "--sdk-color-surface-overlay": surfaceOverlayColor,
    "--sdk-color-surface-panel": shellSurface,
    "--sdk-color-surface-panel-muted": mutedSurface,
    "--sdk-color-text-inverse": resolveReadableTextColor(accentColor),
    "--sdk-color-text-muted": mutedTextColor,
    "--sdk-color-text-primary": foregroundColor,
    "--sdk-color-text-secondary": secondaryTextColor,
    "--sdk-shadow-lg": shadowLg,
    "--sdk-shadow-md": shadowMd,
    "--sdk-shadow-sm": shadowSm,
    "--sdk-shadow-soft": shadowSoft,
    "--theme-primary-50": themeScale["50"],
    "--theme-primary-100": themeScale["100"],
    "--theme-primary-200": themeScale["200"],
    "--theme-primary-300": themeScale["300"],
    "--theme-primary-400": themeScale["400"],
    "--theme-primary-500": themeScale["500"],
    "--theme-primary-600": themeScale["600"],
    "--theme-primary-700": themeScale["700"],
    "--theme-primary-800": themeScale["800"],
    "--theme-primary-900": themeScale["900"],
    "--theme-primary-950": themeScale["950"],
    "--birdcoder-code-font-family": codeFontFamily,
    "--birdcoder-code-font-size": `${Number.parseInt(codeFontSize, 10) || 12}px`,
    "--birdcoder-theme-background": canvasSurface,
    "--birdcoder-theme-foreground": foregroundColor,
    "--birdcoder-theme-surface": shellSurface,
    "--birdcoder-ui-font-family": uiFontFamily,
    "--birdcoder-ui-font-size": `${Number.parseInt(uiFontSize, 10) || 13}px`,
  };
  const surfaceAppearance: UserCenterSurfaceAppearanceInput = {
    preset: "claw",
    theme: {
      badgeBackgroundColor,
      badgeTextColor,
      callbackHeaderBackgroundColor: mutedSurface,
      callbackHeaderTextColor: foregroundColor,
      cardBackgroundColor: isDarkMode
        ? createAlphaColor("#FFFFFF", 0.06, "#FFFFFF")
        : createAlphaColor(shellSurface, 0.58, shellSurface),
      cardBorderColor: isDarkMode ? "transparent" : borderSubtleColor,
      contentBackgroundColor: shellSurface,
      descriptionColor: mutedTextColor,
      emphasisPanelBackgroundColor: emphasisSurface,
      emphasisPanelBorderColor: borderDefaultColor,
      emphasisPanelTextColor: foregroundColor,
      heroPanelBackgroundColor: elevatedSurface,
      heroPanelBorderColor: borderDefaultColor,
      iconWellBackgroundColor,
      iconWellColor,
      oauthProviderCardBackgroundColor: oauthCardBackgroundColor,
      oauthProviderCardBorderColor: borderDefaultColor,
      pageBackgroundColor: canvasSurface,
      qrFrameBackgroundColor,
      qrFrameBorderColor: borderStrongColor,
      sectionSurfaceBackgroundColor: shellSurface,
      sectionSurfaceBorderColor: borderDefaultColor,
      shellBackgroundColor,
      shellBorderColor: borderStrongColor,
      shellShadow: shadowMd,
      standardsCardBackgroundColor: mutedSurface,
      standardsCardBorderColor: borderDefaultColor,
      standardsPanelBackgroundColor: emphasisSurface,
      standardsPanelBorderColor: borderDefaultColor,
      standardsPanelColor: secondaryTextColor,
      titleColor: foregroundColor,
    },
    auth: {
      theme: {
        asideCardBackgroundColor: isDarkMode
          ? authCardBackgroundColor
          : createAlphaColor(authShellSurface, 0.62, authShellSurface),
        asideCardBorderColor: isDarkMode ? borderSubtleColor : borderSubtleColor,
        asideGlowPrimaryColor: authGlowPrimaryColor,
        asideGlowSecondaryColor: authGlowSecondaryColor,
        asideIconWellBackgroundColor: iconWellBackgroundColor,
        asideIconWellColor: iconWellColor,
        asidePanelBackgroundColor: authAsidePanelBackgroundColor,
        asidePanelBorderColor: borderSubtleColor,
        asidePanelColor: foregroundColor,
        badgeBackgroundColor,
        badgeTextColor,
        callbackBackgroundColor: mutedSurface,
        callbackTextColor: foregroundColor,
        descriptionColor: mutedTextColor,
        oauthProviderCardBackgroundColor: authOauthCardBackgroundColor,
        oauthProviderCardBorderColor: borderDefaultColor,
        pageBackgroundColor: authPageBackgroundColor,
        qrFrameBackgroundColor: authQrFrameBackgroundColor,
        qrFrameBorderColor: borderStrongColor,
        shellBackdropFilter: translucent ? "blur(20px)" : undefined,
        shellBackgroundColor: authShellBackgroundColor,
        shellBorderColor: borderStrongColor,
        titleColor: foregroundColor,
      },
      shellStyle: {
        backgroundImage: `linear-gradient(180deg, ${createAlphaColor(authShellSurface, isDarkMode ? 0.96 : 0.98, authShellSurface)} 0%, ${createAlphaColor(mixHexColors(authShellSurface, authPageBackgroundColor, 0.18, authShellSurface), isDarkMode ? 0.90 : 0.94, authShellSurface)} 100%)`,
        boxShadow: authShellShadow,
      },
      asidePanelStyle: {
        boxShadow: `inset 0 1px 0 ${authInsetHighlightColor}`,
      },
      asideCardStyle: {
        boxShadow: `inset 0 1px 0 ${authInsetHighlightColor}`,
      },
      qrFrameStyle: {
        boxShadow: `inset 0 1px 0 ${authInsetHighlightColor}`,
      },
      slotProps: {
        background: {
          style: {
            background: `radial-gradient(circle at 14% 16%, ${createAlphaColor(accentColor, isDarkMode ? 0.12 : 0.10, accentColor)} 0%, transparent 30%), radial-gradient(circle at 84% 82%, ${authGlowSecondaryColor} 0%, transparent 36%), linear-gradient(180deg, ${authPageBackgroundColor} 0%, ${mixHexColors(authPageBackgroundColor, "#000000", isDarkMode ? 0.10 : 0.02, authPageBackgroundColor)} 100%)`,
          },
        },
        contentContainer: {
          style: {
            backgroundColor: authContentPanelBackgroundColor,
            backgroundImage: `linear-gradient(180deg, ${createAlphaColor(authContentSurface, isDarkMode ? 0.92 : 0.96, authContentSurface)} 0%, ${createAlphaColor(mixHexColors(authContentSurface, authPageBackgroundColor, 0.14, authContentSurface), isDarkMode ? 0.80 : 0.88, authContentSurface)} 100%)`,
            borderLeft: `1px solid ${authDividerColor}`,
            boxShadow: `inset 0 1px 0 ${authInsetHighlightColor}`,
          },
        },
      },
    },
  };

  return {
    codeFontFamily,
    codeFontSize,
    colorMode,
    hostStyle,
    surfaceAppearance,
    themeColor,
    themeSelection,
    uiFontFamily,
    uiFontSize,
  };
}

export function useBirdcoderIdentityTheme(): BirdcoderIdentityThemeState {
  const { settings } = useBirdcoderAppSettings();
  const systemColorMode = useSystemColorMode();

  return useMemo(
    () => resolveBirdcoderIdentityThemeState(settings, systemColorMode),
    [settings, systemColorMode],
  );
}

export function useBirdcoderIdentitySurfaceAppearance(): UserCenterSurfaceAppearanceInput {
  return useBirdcoderIdentityTheme().surfaceAppearance;
}
