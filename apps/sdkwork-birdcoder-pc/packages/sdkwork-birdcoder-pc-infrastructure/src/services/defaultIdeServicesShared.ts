import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import type { SdkworkDocumentsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import type { SdkworkPromptsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';
import type { SdkworkSkillsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/skills-app';

import { TauriDesktopRuntimeLocationIdentityPort } from '../platform/tauriDesktopRuntimeLocationIdentity.ts';
import { createBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';
import {
  createBirdCoderAppClient,
  type BirdCoderAppSdkApiClient,
} from './birdCoderSdkClient.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { createBirdCoderDriveSandboxExplorerPort } from './driveSandboxExplorerRuntime.ts';
import { ComposedSdkProjectRuntimeLocationRegistrationPort } from './impl/ComposedSdkProjectRuntimeLocationRegistrationPort.ts';
import { DriveSandboxProjectFileSystemService } from './impl/DriveSandboxProjectFileSystemService.ts';
import { createBirdCoderRuntimeAuthService } from './impl/RuntimeAuthService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';
import { RuntimeProjectRuntimeLocationService } from './impl/RuntimeProjectRuntimeLocationService.ts';
import type { IAuthService } from './interfaces/IAuthService.ts';
import type { IAgentSessionService } from './interfaces/IAgentSessionService.ts';
import type { ICatalogService } from './interfaces/ICatalogService.ts';
import type { IDocumentService } from './interfaces/IDocumentService.ts';
import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { IGitService } from './interfaces/IGitService.ts';
import type { IProjectRuntimeLocationService } from './interfaces/IProjectRuntimeLocationService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IPromptService } from './interfaces/IPromptService.ts';
import type { IVipMembershipService } from './interfaces/IVipMembershipService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';
import { ProjectDeviceMountRegistry } from './ProjectDeviceMountRegistry.ts';
import { createProjectDeviceMountSubjectProvider } from './projectDeviceMountSubject.ts';
import { resolveBirdCoderRuntimeTopology } from './runtimeTopology.ts';
import { createBirdCoderSkillsAppSdkClient } from './skillsSdkClient.ts';

export interface BirdCoderDefaultIdeServices {
  agentSessionService: IAgentSessionService;
  authService: IAuthService;
  catalogService: ICatalogService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  promptService: IPromptService;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  projectService: IProjectService;
  vipMembershipService: IVipMembershipService;
  workspaceService: IWorkspaceService;
}

export type BirdCoderDefaultIdeServiceKey = keyof BirdCoderDefaultIdeServices;

export interface CreateBirdCoderDefaultIdeServicesOptions {
  agentsClient?: AgentsAppSdkClient;
  appClient?: BirdCoderAppSdkApiClient;
  documentsClient?: SdkworkDocumentsAppClient;
  promptsClient?: SdkworkPromptsAppClient;
  skillsClient?: SdkworkSkillsAppClient;
}

export interface BirdCoderDefaultIdeSharedRuntime {
  agentsClient: AgentsAppSdkClient;
  appClient: BirdCoderAppSdkApiClient;
  authService: IAuthService;
  documentsClient: SdkworkDocumentsAppClient;
  fileSystemService: IFileSystemService;
  promptsClient: SdkworkPromptsAppClient;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  skillsClient: SdkworkSkillsAppClient;
}

/**
 * Builds the remote-authority composition shared by all feature ports.
 * BirdCoder never creates a second SQL repository or an in-process API fallback.
 */
export function createBirdCoderDefaultIdeSharedRuntime(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeSharedRuntime {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const appClient =
    options.appClient ??
    runtimeConfig.appClient ??
    createBirdCoderAppClient({
      applicationApiBaseUrl: runtimeConfig.applicationApiBaseUrl,
    });
  const agentsClient =
    options.agentsClient ??
    createBirdCoderAgentsAppSdkClient({
      platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
    });
  const skillsClient =
    options.skillsClient ??
    createBirdCoderSkillsAppSdkClient({
      platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
    });
  const promptsClient =
    options.promptsClient ??
    runtimeConfig.promptsClient;
  const documentsClient =
    options.documentsClient ??
    runtimeConfig.documentsClient;
  if (!promptsClient || !documentsClient) {
    throw new Error(
      'Documents and Prompts SDK clients must be injected by the PC runtime bootstrap.',
    );
  }
  const authService = createBirdCoderRuntimeAuthService();
  const projectDeviceMountRegistry = new ProjectDeviceMountRegistry({
    subjectProvider: createProjectDeviceMountSubjectProvider(),
  });
  const localFileSystem = new RuntimeFileSystemService({
    mountRegistry: projectDeviceMountRegistry,
  });
  const runtimeTopology = runtimeConfig.runtimeTopology ?? resolveBirdCoderRuntimeTopology();
  const fileSystemService = runtimeTopology.executionLocation === 'local-host'
    ? localFileSystem
    : new DriveSandboxProjectFileSystemService({
        bindingClient: appClient,
        drivePort: createBirdCoderDriveSandboxExplorerPort(),
      });
  const projectRuntimeLocationService = new RuntimeProjectRuntimeLocationService({
    executionLocation: runtimeTopology.executionLocation,
    fileSystemService,
    registrationPort: new ComposedSdkProjectRuntimeLocationRegistrationPort({
      identityPort: new TauriDesktopRuntimeLocationIdentityPort({
        mountRegistry: projectDeviceMountRegistry,
      }),
      sdkPort: appClient,
    }),
  });

  return {
    agentsClient,
    appClient,
    authService,
    documentsClient,
    fileSystemService,
    promptsClient,
    projectRuntimeLocationService,
    skillsClient,
  };
}
