import {
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchCodeEngineSelectedModelId,
  type WorkbenchCodeEngineSettingsCarrier,
} from '@sdkwork/birdcoder-codeengine';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

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
  initialCodingSessionId?: string | null;
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
    codingSessionId?: string | null;
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
    codingSessionId: normalizeText(options.codingSessionId),
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
  initialCodingSessionId,
  initialProjectId,
  projects,
}: BuildInitialMultiWindowPaneConfigsOptions): Array<{
  codingSessionId: string;
  engineId?: string;
  modelId?: string;
  projectId: string;
  title: string;
}> {
  const normalizedInitialCodingSessionId = normalizeText(initialCodingSessionId);
  const normalizedInitialProjectId = normalizeText(initialProjectId);
  const seeds = projects.flatMap((project) =>
    project.codingSessions.map((codingSession) => ({
      codingSessionId: codingSession.id,
      engineId: codingSession.engineId,
      modelId: codingSession.modelId,
      projectId: project.id,
      title: codingSession.title,
    })),
  );
  const preferredSeedIndex = seeds.findIndex((seed) =>
    normalizedInitialCodingSessionId
      ? seed.codingSessionId === normalizedInitialCodingSessionId
      : normalizedInitialProjectId
        ? seed.projectId === normalizedInitialProjectId
        : false,
  );

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
        codingSessionId: seed?.codingSessionId,
        engineId: seed?.engineId,
        modelId: seed?.modelId,
        projectId: seed?.projectId ?? fallbackProjectId,
        title: seed?.title ? `${index + 1}. ${seed.title}` : `Window ${index + 1}`,
      },
      options.preferences,
    );
  });
}
