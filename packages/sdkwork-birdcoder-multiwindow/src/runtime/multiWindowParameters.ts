import type {
  MultiWindowModelParameters,
} from '../types.ts';

export const DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS: MultiWindowModelParameters = {
  maxOutputTokens: 4096,
  systemPrompt: '',
  temperature: 0.2,
  topP: 0.9,
};

export function createDefaultMultiWindowModelParameters(
  value: Partial<MultiWindowModelParameters> = {},
): MultiWindowModelParameters {
  return {
    maxOutputTokens: Math.max(
      256,
      Math.min(
        128000,
        Math.floor(value.maxOutputTokens ?? DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.maxOutputTokens),
      ),
    ),
    systemPrompt: value.systemPrompt?.trim() ?? DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.systemPrompt,
    temperature: Math.max(
      0,
      Math.min(2, Number(value.temperature ?? DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.temperature)),
    ),
    topP: Math.max(
      0,
      Math.min(1, Number(value.topP ?? DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.topP)),
    ),
  };
}
