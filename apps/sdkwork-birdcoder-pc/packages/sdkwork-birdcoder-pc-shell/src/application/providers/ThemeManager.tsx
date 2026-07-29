import { useEffect } from "react";
import { useBirdcoderTheme } from "@sdkwork/birdcoder-pc-workbench/theme/birdcoderTheme";

export function ThemeManager() {
  const {
    codeFontFamily,
    codeFontSize,
    colorMode,
    hostStyle,
    sidebarTranslucent,
    themeColor,
    uiFontFamily,
    uiFontSize,
    usePointerCursor,
  } = useBirdcoderTheme();

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const previousAttributes = {
      sdkColorMode: root.getAttribute("data-sdk-color-mode"),
      sidebarTranslucent: root.getAttribute("data-birdcoder-sidebar-translucent"),
      theme: root.getAttribute("data-theme"),
      usePointerCursor: root.getAttribute("data-birdcoder-pointer-cursor"),
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
    const hadLightModeClass = root.classList.contains("light-mode");

    root.setAttribute("data-theme", themeColor);
    root.setAttribute("data-sdk-color-mode", colorMode);
    root.setAttribute("data-birdcoder-sidebar-translucent", sidebarTranslucent ? "true" : "false");
    root.setAttribute("data-birdcoder-pointer-cursor", usePointerCursor ? "true" : "false");
    root.classList.toggle("dark", colorMode === "dark");
    root.classList.toggle("light-mode", colorMode === "light");
    root.style.colorScheme = colorMode;
    root.style.fontFamily = uiFontFamily;
    root.style.setProperty("--birdcoder-ui-font-family", uiFontFamily);
    root.style.setProperty("--birdcoder-code-font-family", codeFontFamily);
    root.style.setProperty("--birdcoder-ui-font-size", `${Number.parseInt(uiFontSize, 10) || 12}px`);
    root.style.setProperty("--birdcoder-code-font-size", `${Number.parseInt(codeFontSize, 10) || 12}px`);

    Object.entries(hostStyle).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    return () => {
      root.classList.toggle("dark", hadDarkClass);
      root.classList.toggle("light-mode", hadLightModeClass);

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

      if (previousAttributes.sidebarTranslucent) {
        root.setAttribute("data-birdcoder-sidebar-translucent", previousAttributes.sidebarTranslucent);
      } else {
        root.removeAttribute("data-birdcoder-sidebar-translucent");
      }

      if (previousAttributes.usePointerCursor) {
        root.setAttribute("data-birdcoder-pointer-cursor", previousAttributes.usePointerCursor);
      } else {
        root.removeAttribute("data-birdcoder-pointer-cursor");
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
    sidebarTranslucent,
    themeColor,
    uiFontFamily,
    uiFontSize,
    usePointerCursor,
  ]);

  return null;
}
