import { useEffect, useMemo, useState } from "react";
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

export interface BirdcoderThemeState {
  codeFontFamily: string;
  codeFontSize: string;
  colorMode: SdkworkColorMode;
  hostStyle: Record<string, string>;
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

export function resolveBirdcoderThemeState(
  settings: AppSettings,
  systemColorMode: SdkworkColorMode = "dark",
): BirdcoderThemeState {
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
  const borderSubtleColor = createAlphaColor(foregroundColor, isDarkMode ? 0.08 : 0.06, foregroundColor);
  const borderDefaultColor = createAlphaColor(foregroundColor, isDarkMode ? 0.14 : 0.10, foregroundColor);
  const borderStrongColor = createAlphaColor(foregroundColor, isDarkMode ? 0.18 : 0.14, foregroundColor);
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
  return {
    codeFontFamily,
    codeFontSize,
    colorMode,
    hostStyle,
    themeColor,
    themeSelection,
    uiFontFamily,
    uiFontSize,
  };
}

export function useBirdcoderTheme(): BirdcoderThemeState {
  const { settings } = useBirdcoderAppSettings();
  const systemColorMode = useSystemColorMode();

  return useMemo(
    () => resolveBirdcoderThemeState(settings, systemColorMode),
    [settings, systemColorMode],
  );
}
