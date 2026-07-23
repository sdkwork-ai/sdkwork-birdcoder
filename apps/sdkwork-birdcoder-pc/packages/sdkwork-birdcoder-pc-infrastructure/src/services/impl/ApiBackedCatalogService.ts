import type {
  SdkworkSkillsAppClient,
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type {
  ICatalogService,
  InstallSkillPackageOptions,
} from '../interfaces/ICatalogService.ts';

export interface ApiBackedCatalogServiceOptions {
  skillsClient: SdkworkSkillsAppClient;
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly skillsClient: SdkworkSkillsAppClient;

  constructor({ skillsClient }: ApiBackedCatalogServiceOptions) {
    this.skillsClient = skillsClient;
  }

  async getSkillPackages(
    params?: SkillsSkillPackagesListParams,
  ): Promise<SkillPackagesPageData> {
    return this.skillsClient.skills.skillPackages.list(params);
  }

  async listInstallableArtifacts(
    packageId: string,
    params?: SkillsSkillPackagesArtifactsListParams,
  ): Promise<SkillArtifactsPageData> {
    return this.skillsClient.skills.skillPackages.artifacts.list(packageId, params);
  }

  async installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<SkillInstallationRecord> {
    return this.skillsClient.skills.skillPackages.installations.create(packageId, {
      artifactId: options.artifactId,
      target: {
        id: options.projectId,
        kind: 'project',
      },
      ...(options.config ? { config: options.config } : {}),
    });
  }
}
