export type SdkworkShellThemeColor = "zinc" | "lobster" | "green-tech" | "tech-blue" | "violet" | "rose";
export type SdkworkShellThemeSelection = "light" | "dark" | "system";
export type SdkworkPcReactHost = "browser" | "server" | "tauri";

export interface SdkworkAppCapabilityThemePreset {
  color: SdkworkShellThemeColor;
  preset: "sdkwork";
  selection: SdkworkShellThemeSelection;
}

export interface SdkworkAppCapabilityManifest {
  architecture: "pc-react";
  description?: string;
  host: SdkworkPcReactHost;
  id: string;
  packageNames: string[];
  theme: SdkworkAppCapabilityThemePreset;
  title: string;
}

export interface CreateSdkworkAppCapabilityManifestOptions {
  description?: string;
  host?: SdkworkPcReactHost;
  id: string;
  packageNames?: string[];
  theme?: Partial<SdkworkAppCapabilityThemePreset>;
  title: string;
}

export declare function createSdkworkAppCapabilityManifest(
  options: CreateSdkworkAppCapabilityManifestOptions,
): SdkworkAppCapabilityManifest;
