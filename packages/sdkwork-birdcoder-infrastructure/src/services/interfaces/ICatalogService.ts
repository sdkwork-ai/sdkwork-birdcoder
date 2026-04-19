import type {
  BirdCoderAppTemplateSummary,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
} from '@sdkwork/birdcoder-types';

export interface InstallSkillPackageOptions {
  workspaceId: string;
}

export interface ICatalogService {
  getAppTemplates(): Promise<BirdCoderAppTemplateSummary[]>;
  getSkillPackages(workspaceId?: string): Promise<BirdCoderSkillPackageSummary[]>;
  installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<BirdCoderSkillInstallationSummary>;
}
