import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import type { SdkworkDocumentsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import type { SdkworkPromptsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';
import type { SdkworkSkillsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/skills-app';

import { TauriDesktopRuntimeLocationIdentityPort } from '../platform/tauriDesktopRuntimeLocationIdentity.ts';
import { createBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';
import { createBirdCoderDocumentsAppSdkClient } from './dependencyAppSdkClients.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { createBirdCoderDriveSandboxExplorerPort } from './driveSandboxExplorerRuntime.ts';
import { AgentsDocumentsProjectDocumentService } from './impl/AgentsDocumentsProjectDocumentService.ts';
import { DriveSandboxProjectFileSystemService } from './impl/DriveSandboxProjectFileSystemService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { createBirdCoderRuntimeAuthService } from './impl/RuntimeAuthService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';
import { RuntimeProjectRuntimeLocationService } from './impl/RuntimeProjectRuntimeLocationService.ts';
import { createTauriProjectGitRuntime } from '../platform/tauriProjectGitRuntime.ts';
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
}

export type BirdCoderDefaultIdeServiceKey = keyof BirdCoderDefaultIdeServices;

export interface CreateBirdCoderDefaultIdeServicesOptions {
  agentsClient?: AgentsAppSdkClient;
  documentsClient?: SdkworkDocumentsAppClient;
  promptsClient?: SdkworkPromptsAppClient;
  skillsClient?: SdkworkSkillsAppClient;
}

export interface BirdCoderDefaultIdeSharedRuntime {
  agentsClient: AgentsAppSdkClient;
  authService: IAuthService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  promptsClient: SdkworkPromptsAppClient;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  projectService: IProjectService;
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
  if (!promptsClient) {
    throw new Error('The Prompts SDK client must be injected by the PC runtime bootstrap.');
  }
  const authService = createBirdCoderRuntimeAuthService();
  const projectDeviceMountRegistry = new ProjectDeviceMountRegistry({
    subjectProvider: createProjectDeviceMountSubjectProvider(),
  });
  const localFileSystem = new RuntimeFileSystemService({
    mountRegistry: projectDeviceMountRegistry,
  });
  const projectService = new ApiBackedProjectService({
    projectCompositionSlots: agentsClient.ai.agents.projectCompositionSlots,
    projects: agentsClient.ai.agents.projects,
  });
  let documentsClient = options.documentsClient ?? runtimeConfig.documentsClient;
  const documentService = new AgentsDocumentsProjectDocumentService({
    projectCompositionSlots: agentsClient.ai.agents.projectCompositionSlots,
    resolveDocumentsClient: () => {
      documentsClient ??= createBirdCoderDocumentsAppSdkClient({
        platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
      });
      return documentsClient.documents;
    },
  });
  const runtimeTopology = runtimeConfig.runtimeTopology ?? resolveBirdCoderRuntimeTopology();
  const fileSystemService = runtimeTopology.executionLocation === 'local-host'
    ? localFileSystem
    : new DriveSandboxProjectFileSystemService({
        drivePort: createBirdCoderDriveSandboxExplorerPort(),
        projectService,
      });
  const projectRuntimeLocationService = new RuntimeProjectRuntimeLocationService({
    executionLocation: runtimeTopology.executionLocation,
    fileSystemService,
    identityPort: new TauriDesktopRuntimeLocationIdentityPort({
      mountRegistry: projectDeviceMountRegistry,
    }),
  });
  const gitService = createTauriProjectGitRuntime({
    resolveProjectRoot: async (projectId) => {
      const resolution = await projectRuntimeLocationService.resolveProjectRuntimeLocation(
        projectId,
        {
          allowFolderSelection: false,
          capability: 'git',
        },
      );
      return resolution.status === 'resolved'
        ? resolution.location.localWorkingDirectory
        : null;
    },
  });

  return {
    agentsClient,
    authService,
    documentService,
    fileSystemService,
    gitService,
    promptsClient,
    projectRuntimeLocationService,
    projectService,
    skillsClient,
  };
}
