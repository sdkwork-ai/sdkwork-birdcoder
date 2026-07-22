import type { BirdCoderAppTemplateSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  SdkworkSkillsAppClient,
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/skills-app-sdk';
import type {
  ICatalogService,
  InstallSkillPackageOptions,
} from '../interfaces/ICatalogService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedCatalogServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  skillsClient: SdkworkSkillsAppClient;
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly skillsClient: SdkworkSkillsAppClient;

  constructor({ appClient, skillsClient }: ApiBackedCatalogServiceOptions) {
    this.appClient = appClient;
    this.skillsClient = skillsClient;
  }

  async getAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
    return this.appClient.listAppTemplates();
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
        id: options.workspaceId,
        kind: 'workspace',
      },
      ...(options.config ? { config: options.config } : {}),
    });
  }
}
