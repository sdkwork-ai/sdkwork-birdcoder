import type {
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';

export interface InstallSkillPackageOptions {
  artifactId: string;
  config?: Record<string, unknown>;
  projectId: string;
}

export interface ComposerProviderCapabilityItem {
  description: string;
  enabled: boolean;
  id: string;
  name: string;
  targetRef: string;
}

export interface ComposerProviderCapabilities {
  plugins: ComposerProviderCapabilityItem[];
  skills: ComposerProviderCapabilityItem[];
}

export interface ComposerProviderCapabilitiesOptions {
  agentId: string;
  page?: number;
  pageSize?: number;
}

export interface ICatalogService {
  getComposerProviderCapabilities(
    options: ComposerProviderCapabilitiesOptions,
  ): Promise<ComposerProviderCapabilities>;
  getSkillPackages(params?: SkillsSkillPackagesListParams): Promise<SkillPackagesPageData>;
  listInstallableArtifacts(
    packageId: string,
    params?: SkillsSkillPackagesArtifactsListParams,
  ): Promise<SkillArtifactsPageData>;
  installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<SkillInstallationRecord>;
}
