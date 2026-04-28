import {
  createDefaultMultiWindowModelParameters,
} from './multiWindowParameters.ts';
import {
  normalizeMultiWindowLayoutCount,
} from './multiWindowLayout.ts';
import type {
  MultiWindowPaneConfig,
} from '../types.ts';
import type {
  MultiWindowExecutionProfile,
} from './multiWindowPromptProfile.ts';

export const MULTI_WINDOW_MESSAGE_METADATA_KEY = 'multiWindow';
export const MULTI_WINDOW_MESSAGE_METADATA_VERSION = 1;

export interface BuildMultiWindowMessageMetadataOptions {
  broadcastId: string;
  executionProfile?: MultiWindowExecutionProfile;
  pane: MultiWindowPaneConfig;
  paneIndex: number;
  windowCount: number;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function buildMultiWindowMessageMetadata({
  broadcastId,
  executionProfile,
  pane,
  paneIndex,
  windowCount,
}: BuildMultiWindowMessageMetadataOptions): Record<string, unknown> {
  return {
    [MULTI_WINDOW_MESSAGE_METADATA_KEY]: {
      broadcastId: normalizeText(broadcastId),
      engineId: normalizeText(pane.selectedEngineId),
      mode: pane.mode,
      modelId: normalizeText(pane.selectedModelId),
      paneId: pane.id,
      paneIndex,
      paneTitle: pane.title,
      parameters:
        executionProfile?.parameters ??
        createDefaultMultiWindowModelParameters(pane.parameters),
      previewUrl: pane.previewUrl,
      version: MULTI_WINDOW_MESSAGE_METADATA_VERSION,
      windowCount: normalizeMultiWindowLayoutCount(windowCount),
      ...(executionProfile ? { executionProfile } : {}),
    },
  };
}
