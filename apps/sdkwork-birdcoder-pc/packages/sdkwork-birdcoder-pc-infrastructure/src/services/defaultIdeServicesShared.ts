import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import type { SdkworkDocumentsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import type { SdkworkPromptsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';
import type { SdkworkSkillsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type { McpAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/mcp-app';

import { TauriDesktopRuntimeLocationIdentityPort } from '../platform/tauriDesktopRuntimeLocationIdentity.ts';
import { createBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';
import { createBirdCoderDocumentsAppSdkClient } from './dependencyAppSdkClients.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { createBirdCoderDriveSandboxExplorerPort } from './driveSandboxExplorerRuntime.ts';
import { ApplicationPublishService } from './impl/ApplicationPublishService.ts';
import { AgentsDocumentsProjectDocumentService } from './impl/AgentsDocumentsProjectDocumentService.ts';
import { DriveSandboxProjectFileSystemService } from './impl/DriveSandboxProjectFileSystemService.ts';
import { ApiBackedProjectService } from './impl/ApiBackedProjectService.ts';
import { ApiBackedWorkspaceService } from './impl/ApiBackedWorkspaceService.ts';
import { createBirdCoderRuntimeAuthService } from './impl/RuntimeAuthService.ts';
import { RuntimeFileSystemService } from './impl/RuntimeFileSystemService.ts';
import { RuntimeProjectRuntimeLocationService } from './impl/RuntimeProjectRuntimeLocationService.ts';
import { createTauriProjectGitRuntime } from '../platform/tauriProjectGitRuntime.ts';
import type { IAuthService } from './interfaces/IAuthService.ts';
import type { IApplicationPublishService } from './interfaces/IApplicationPublishService.ts';
import type { IAgentSessionService } from './interfaces/IAgentSessionService.ts';
import type { ICatalogService } from './interfaces/ICatalogService.ts';
import type { IDocumentService } from './interfaces/IDocumentService.ts';
import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { IGitService } from './interfaces/IGitService.ts';
import type { IProjectRuntimeLocationService } from './interfaces/IProjectRuntimeLocationService.ts';
import type { IProjectService } from './interfaces/IProjectService.ts';
import type { IWorkspaceService } from './interfaces/IWorkspaceService.ts';
import type { IPromptService } from './interfaces/IPromptService.ts';
import type { IVipMembershipService } from './interfaces/IVipMembershipService.ts';
import { ProjectDeviceMountRegistry } from './ProjectDeviceMountRegistry.ts';
import { createProjectDeviceMountSubjectProvider } from './projectDeviceMountSubject.ts';
import { createProjectFileSystemService } from './projectFileSystemServiceFactory.ts';
import { resolveBirdCoderRuntimeTopology } from './runtimeTopology.ts';
import { createBirdCoderSkillsAppSdkClient } from './skillsSdkClient.ts';
import { createBirdCoderMcpAppSdkClient } from './mcpSdkClient.ts';

export interface BirdCoderDefaultIdeServices {
  agentSessionService: IAgentSessionService;
  applicationPublishService: IApplicationPublishService;
  authService: IAuthService;
  catalogService: ICatalogService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  promptService: IPromptService;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  projectService: IProjectService;
  workspaceService: IWorkspaceService;
  vipMembershipService: IVipMembershipService;
}

export type BirdCoderDefaultIdeServiceKey = keyof BirdCoderDefaultIdeServices;

export interface CreateBirdCoderDefaultIdeServicesOptions {
  agentsClient?: AgentsAppSdkClient;
  documentsClient?: SdkworkDocumentsAppClient;
  mcpClient?: McpAppSdkClient;
  promptsClient?: SdkworkPromptsAppClient;
  skillsClient?: SdkworkSkillsAppClient;
}

export interface BirdCoderDefaultIdeSharedRuntime {
  agentsClient: AgentsAppSdkClient;
  applicationPublishService: IApplicationPublishService;
  authService: IAuthService;
  documentService: IDocumentService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  mcpClient: McpAppSdkClient;
  promptsClient: SdkworkPromptsAppClient;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  projectDeviceMountRegistry: ProjectDeviceMountRegistry;
  projectService: IProjectService;
  skillsClient: SdkworkSkillsAppClient;
  workspaceService: IWorkspaceService;
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
  const mcpClient =
    options.mcpClient ??
    createBirdCoderMcpAppSdkClient({
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
  const projectService = new ApiBackedProjectService({
    projectCompositionSlots: agentsClient.ai.agents.projectCompositionSlots,
    projects: agentsClient.ai.agents.projects,
  });
  const workspaceService = new ApiBackedWorkspaceService(
    agentsClient.ai.agents.workspaces,
  );
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
  const fileSystemService = createProjectFileSystemService({
    createLocalFileSystem: () => new RuntimeFileSystemService({
      mountRegistry: projectDeviceMountRegistry,
    }),
    createRemoteFileSystem: () => new DriveSandboxProjectFileSystemService({
      drivePort: createBirdCoderDriveSandboxExplorerPort(),
      projectService,
    }),
    executionLocation: runtimeTopology.executionLocation,
  });
  const projectRuntimeLocationService = new RuntimeProjectRuntimeLocationService({
    executionLocation: runtimeTopology.executionLocation,
    fileSystemService,
    identityPort: new TauriDesktopRuntimeLocationIdentityPort({
      mountRegistry: projectDeviceMountRegistry,
    }),
  });
  const applicationPublishService = new ApplicationPublishService({
    projectRuntimeLocationService,
  });
  const gitService = createTauriProjectGitRuntime({
    resolveProjectRoot: (projectId) =>
      projectRuntimeLocationService.resolveProjectLocalWorkingDirectory(
        projectId,
        {
          allowFolderSelection: false,
          capability: 'git',
        },
      ),
  });

  return {
    agentsClient,
    applicationPublishService,
    authService,
    documentService,
    fileSystemService,
    gitService,
    mcpClient,
    promptsClient,
    projectRuntimeLocationService,
    projectDeviceMountRegistry,
    projectService,
    skillsClient,
    workspaceService,
  };
}
