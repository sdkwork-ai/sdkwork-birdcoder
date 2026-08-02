import { BirdCoderAgentSessionService } from './agentsSessionService.ts';
import {
  createBirdCoderDefaultIdeSharedRuntime,
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';
import { ApiBackedCatalogService } from './impl/ApiBackedCatalogService.ts';
import { ApiBackedVipMembershipService } from './impl/ApiBackedVipMembershipService.ts';
import { AgentsSdkAutomationService } from './impl/AgentsSdkAutomationService.ts';
import { AgentsSdkModelConfigurationService } from './agentsModelConfigurationService.ts';
import { ModelsSdkModelAccessCatalogService } from './impl/ModelsSdkModelAccessCatalogService.ts';
import { isBirdCoderTauriRuntime } from '../platform/tauriRuntime.ts';
import {
  InMemoryUserModelConfigService,
  TauriUserModelConfigService,
} from './userModelConfigService.ts';
import { PromptsSdkPromptService } from './impl/PromptsSdkPromptService.ts';

export {
  type BirdCoderDefaultIdeServices,
  type CreateBirdCoderDefaultIdeServicesOptions,
} from './defaultIdeServicesShared.ts';

export function createDefaultBirdCoderIdeServices(
  options: CreateBirdCoderDefaultIdeServicesOptions = {},
): BirdCoderDefaultIdeServices {
  const runtime = createBirdCoderDefaultIdeSharedRuntime(options);

  return {
    agentAutomationService: new AgentsSdkAutomationService(runtime.agentsClient),
    agentModelConfigurationService: new AgentsSdkModelConfigurationService(runtime.agentsClient),
    // The sqlite store is only reachable from the Tauri host; browser and
    // test-runner surfaces use the in-memory fallback instead of failing invokes.
    userModelConfigService: isBirdCoderTauriRuntime()
      ? new TauriUserModelConfigService()
      : new InMemoryUserModelConfigService(),
    modelAccessCatalogService: new ModelsSdkModelAccessCatalogService(runtime.modelsClient),
    agentSessionService: new BirdCoderAgentSessionService({
      client: runtime.agentsClient,
    }),
    applicationPublishService: runtime.applicationPublishService,
    authService: runtime.authService,
    catalogService: new ApiBackedCatalogService({
      agentsClient: runtime.agentsClient,
      mcpClient: runtime.mcpClient,
      skillsClient: runtime.skillsClient,
    }),
    documentService: runtime.documentService,
    fileSystemService: runtime.fileSystemService,
    gitService: runtime.gitService,
    projectRuntimeLocationService: runtime.projectRuntimeLocationService,
    promptService: new PromptsSdkPromptService(runtime.promptsClient),
    projectService: runtime.projectService,
    agentWorkspaceService: runtime.agentWorkspaceService,
    vipMembershipService: new ApiBackedVipMembershipService(),
  };
}
