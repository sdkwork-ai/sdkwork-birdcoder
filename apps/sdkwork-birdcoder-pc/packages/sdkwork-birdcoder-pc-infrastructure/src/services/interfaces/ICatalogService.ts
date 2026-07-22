import type { BirdCoderAppTemplateSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/skills-app-sdk';

export interface InstallSkillPackageOptions {
  artifactId: string;
  config?: Record<string, unknown>;
  workspaceId: string;
}

export interface ICatalogService {
  getAppTemplates(): Promise<BirdCoderAppTemplateSummary[]>;
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
