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

export interface ICatalogService {
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
