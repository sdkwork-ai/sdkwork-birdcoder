import { useEffect } from "react";
import { useBirdcoderIdentityTheme } from "@sdkwork/birdcoder-commons";

export function ThemeManager() {
  const {
    codeFontFamily,
    codeFontSize,
    colorMode,
    hostStyle,
    themeColor,
    uiFontFamily,
    uiFontSize,
  } = useBirdcoderIdentityTheme();

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const previousAttributes = {
      sdkColorMode: root.getAttribute("data-sdk-color-mode"),
      theme: root.getAttribute("data-theme"),
    };
    const previousFontFamily = root.style.fontFamily;
    const previousColorScheme = root.style.colorScheme;
    const previousStyleEntries = [
      ...Object.keys(hostStyle),
      "--birdcoder-ui-font-family",
      "--birdcoder-code-font-family",
      "--birdcoder-ui-font-size",
      "--birdcoder-code-font-size",
    ].map((name) => [name, root.style.getPropertyValue(name)] as const);
    const hadDarkClass = root.classList.contains("dark");

    root.setAttribute("data-theme", themeColor);
    root.setAttribute("data-sdk-color-mode", colorMode);
    root.classList.toggle("dark", colorMode === "dark");
    root.style.colorScheme = colorMode;
    root.style.fontFamily = uiFontFamily;
    root.style.setProperty("--birdcoder-ui-font-family", uiFontFamily);
    root.style.setProperty("--birdcoder-code-font-family", codeFontFamily);
    root.style.setProperty("--birdcoder-ui-font-size", `${Number.parseInt(uiFontSize, 10) || 13}px`);
    root.style.setProperty("--birdcoder-code-font-size", `${Number.parseInt(codeFontSize, 10) || 12}px`);

    Object.entries(hostStyle).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    return () => {
      root.classList.toggle("dark", hadDarkClass);

      if (previousAttributes.theme) {
        root.setAttribute("data-theme", previousAttributes.theme);
      } else {
        root.removeAttribute("data-theme");
      }

      if (previousAttributes.sdkColorMode) {
        root.setAttribute("data-sdk-color-mode", previousAttributes.sdkColorMode);
      } else {
        root.removeAttribute("data-sdk-color-mode");
      }

      root.style.fontFamily = previousFontFamily;
      root.style.colorScheme = previousColorScheme;

      previousStyleEntries.forEach(([name, value]) => {
        if (value) {
          root.style.setProperty(name, value);
          return;
        }

        root.style.removeProperty(name);
      });
    };
  }, [
    codeFontFamily,
    codeFontSize,
    colorMode,
    hostStyle,
    themeColor,
    uiFontFamily,
    uiFontSize,
  ]);

  return null;
}
