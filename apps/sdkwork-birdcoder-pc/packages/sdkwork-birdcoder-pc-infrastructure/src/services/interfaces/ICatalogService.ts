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
  source?: 'remote' | 'local';
  status?: 'enabled' | 'manifest-only' | 'unavailable';
}

export interface ComposerProviderCapabilityLoadError {
  message: string;
  source: 'remote' | 'local';
  providerId?: string;
}

export interface ComposerProviderCapabilities {
  plugins: ComposerProviderCapabilityItem[];
  skills: ComposerProviderCapabilityItem[];
  errors: ComposerProviderCapabilityLoadError[];
}

export interface ComposerProviderCapabilitiesOptions {
  agentId: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
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
