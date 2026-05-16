export interface CreateSdkworkAppCapabilityManifestOptions {
  capabilities?: readonly string[];
  packageName?: string;
  sourcePackageName?: string;
  title?: string;
}

export interface SdkworkAppCapabilityManifest {
  capabilities: readonly string[];
  packageName?: string;
  sourcePackageName?: string;
  title?: string;
}

export declare function createSdkworkAppCapabilityManifest(
  options?: CreateSdkworkAppCapabilityManifestOptions,
): SdkworkAppCapabilityManifest;
