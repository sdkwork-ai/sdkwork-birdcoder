import {
  createDefaultMultiWindowModelParameters,
} from './multiWindowParameters.ts';
import type {
  MultiWindowModelParameters,
  MultiWindowPaneConfig,
} from '../types.ts';

export type MultiWindowParameterApplication =
  | 'inline-prompt'
  | 'metadata';

export interface MultiWindowExecutionProfile {
  parameterApplication: {
    maxOutputTokens: MultiWindowParameterApplication;
    systemPrompt: MultiWindowParameterApplication;
    temperature: MultiWindowParameterApplication;
    topP: MultiWindowParameterApplication;
  };
  parameters: MultiWindowModelParameters;
  version: 1;
}

export interface MultiWindowPaneDispatchPrompt {
  executionProfile: MultiWindowExecutionProfile;
  prompt: string;
}

function normalizePromptText(value: string): string {
  return value.trim();
}

function buildMultiWindowExecutionProfile(
  parameters: Partial<MultiWindowModelParameters>,
): MultiWindowExecutionProfile {
  return {
    parameterApplication: {
      maxOutputTokens: 'metadata',
      systemPrompt: 'inline-prompt',
      temperature: 'metadata',
      topP: 'metadata',
    },
    parameters: createDefaultMultiWindowModelParameters(parameters),
    version: 1,
  };
}

function applySystemPromptToUserPrompt(
  prompt: string,
  systemPrompt: string,
): string {
  const normalizedPrompt = normalizePromptText(prompt);
  const normalizedSystemPrompt = normalizePromptText(systemPrompt);
  if (!normalizedSystemPrompt) {
    return normalizedPrompt;
  }

  return [
    'System instructions for this multi-window pane:',
    normalizedSystemPrompt,
    '',
    'User request:',
    normalizedPrompt,
  ].join('\n');
}

export function buildMultiWindowPaneDispatchPrompt(
  prompt: string,
  pane: MultiWindowPaneConfig,
): MultiWindowPaneDispatchPrompt {
  const executionProfile = buildMultiWindowExecutionProfile(pane.parameters);

  return {
    executionProfile,
    prompt: applySystemPromptToUserPrompt(
      prompt,
      executionProfile.parameters.systemPrompt,
    ),
  };
}
