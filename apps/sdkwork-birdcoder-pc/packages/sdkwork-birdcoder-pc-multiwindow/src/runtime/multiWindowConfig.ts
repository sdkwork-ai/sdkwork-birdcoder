import {
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchCodeEngineSelectedModelId,
  type WorkbenchCodeEngineSettingsCarrier,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  MAX_MULTI_WINDOW_PANES,
} from './multiWindowLayout.ts';
import {
  createDefaultMultiWindowModelParameters,
} from './multiWindowParameters.ts';
import type {
  MultiWindowPaneConfig,
  MultiWindowPaneMode,
} from '../types.ts';

interface BuildInitialMultiWindowPaneConfigsOptions {
  initialAgentSessionId?: string | null;
  initialProjectId?: string | null;
  preferences?: WorkbenchCodeEngineSettingsCarrier | null;
  projects: readonly BirdCoderProject[];
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function createMultiWindowPaneId(index: number): string {
  return `multiwindow-pane-${Math.max(0, Math.floor(index)) + 1}`;
}

export function normalizeMultiWindowPaneMode(
  value: string | null | undefined,
): MultiWindowPaneMode {
  return value === 'preview' ? 'preview' : 'chat';
}

export function createDefaultMultiWindowPaneConfig(
  index: number,
  options: {
    agentSessionId?: string | null;
    engineId?: string | null;
    modelId?: string | null;
    mode?: string | null;
    projectId?: string | null;
    title?: string | null;
  } = {},
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): MultiWindowPaneConfig {
  const selectedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    options.engineId,
    preferences,
  );
  const selectedModelId = options.modelId?.trim()
    ? normalizeWorkbenchCodeModelId(selectedEngineId, options.modelId, preferences)
    : resolveWorkbenchCodeEngineSelectedModelId(selectedEngineId, preferences);

  return {
    agentSessionId: normalizeText(options.agentSessionId),
    enabled: true,
    id: createMultiWindowPaneId(index),
    mode: normalizeMultiWindowPaneMode(options.mode),
    parameters: createDefaultMultiWindowModelParameters(),
    previewUrl: 'about:blank',
    projectId: normalizeText(options.projectId),
    selectedEngineId,
    selectedModelId,
    title: normalizeText(options.title) || `Window ${index + 1}`,
  };
}

function collectSessionSeeds({
  initialAgentSessionId,
  initialProjectId,
  projects,
}: BuildInitialMultiWindowPaneConfigsOptions): Array<{
  agentSessionId: string;
  engineId?: string;
  modelId?: string;
  projectId: string;
  title: string;
}> {
  const normalizedInitialAgentSessionId = normalizeText(initialAgentSessionId);
  const normalizedInitialProjectId = normalizeText(initialProjectId);
  const seeds = projects.flatMap((project) =>
    project.agentSessions.map((agentSession) => ({
      agentSessionId: agentSession.id,
      engineId: agentSession.engineId,
      modelId: agentSession.modelId,
      projectId: project.id,
      title: agentSession.title,
    })),
  );
  const initialProjectExists = normalizedInitialProjectId
    ? projects.some((project) => project.id === normalizedInitialProjectId)
    : false;
  const scopedProjectSeeds = initialProjectExists
    ? seeds.filter((seed) => seed.projectId === normalizedInitialProjectId)
    : [];
  if (initialProjectExists) {
    if (normalizedInitialAgentSessionId) {
      const exactScopedSeed = scopedProjectSeeds.find(
        (seed) => seed.agentSessionId === normalizedInitialAgentSessionId,
      );
      if (!exactScopedSeed) {
        return [
          {
            agentSessionId: normalizedInitialAgentSessionId,
            projectId: normalizedInitialProjectId,
            title: '',
          },
          ...scopedProjectSeeds,
        ];
      }

      return [
        exactScopedSeed,
        ...seeds.filter((seed) => seed !== exactScopedSeed),
      ];
    }

    return scopedProjectSeeds.length > 0
      ? [
          ...scopedProjectSeeds,
          ...seeds.filter((seed) => seed.projectId !== normalizedInitialProjectId),
        ]
      : [];
  }

  const matchingSessionSeeds = normalizedInitialAgentSessionId
    ? seeds.filter((seed) => seed.agentSessionId === normalizedInitialAgentSessionId)
    : [];
  const preferredSeedIndex =
    normalizedInitialAgentSessionId && matchingSessionSeeds.length === 1
      ? seeds.indexOf(matchingSessionSeeds[0])
      : -1;

  if (preferredSeedIndex <= 0) {
    return seeds;
  }

  const preferredSeed = seeds[preferredSeedIndex];
  return preferredSeed
    ? [preferredSeed, ...seeds.slice(0, preferredSeedIndex), ...seeds.slice(preferredSeedIndex + 1)]
    : seeds;
}

export function buildInitialMultiWindowPaneConfigs(
  options: BuildInitialMultiWindowPaneConfigsOptions,
): MultiWindowPaneConfig[] {
  const sessionSeeds = collectSessionSeeds(options);
  const fallbackProjectId =
    normalizeText(options.initialProjectId) ||
    options.projects[0]?.id ||
    '';

  return Array.from({ length: MAX_MULTI_WINDOW_PANES }, (_, index) => {
    const seed = sessionSeeds[index] ?? sessionSeeds[0];
    return createDefaultMultiWindowPaneConfig(
      index,
      {
        agentSessionId: seed?.agentSessionId,
        engineId: seed?.engineId,
        modelId: seed?.modelId,
        projectId: seed?.projectId ?? fallbackProjectId,
        title: seed?.title ? `${index + 1}. ${seed.title}` : `Window ${index + 1}`,
      },
      options.preferences,
    );
  });
}

