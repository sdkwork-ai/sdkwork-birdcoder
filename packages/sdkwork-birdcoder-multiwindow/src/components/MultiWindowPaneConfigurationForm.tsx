import {
  findWorkbenchCodeEngineDefinition,
  listWorkbenchServerImplementedCodeEngines,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchCodeEngineSelectedModelId,
} from '@sdkwork/birdcoder-codeengine';
import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createDefaultMultiWindowModelParameters,
} from '../runtime/multiWindowParameters.ts';
import type {
  MultiWindowPaneConfig,
  MultiWindowPaneMode,
} from '../types.ts';

interface MultiWindowPaneConfigurationFormProps {
  pane: MultiWindowPaneConfig;
  preferences: WorkbenchPreferences;
  onChange: (pane: MultiWindowPaneConfig) => void;
}

export const MultiWindowPaneConfigurationForm = memo(function MultiWindowPaneConfigurationForm({
  pane,
  preferences,
  onChange,
}: MultiWindowPaneConfigurationFormProps) {
  const { t } = useTranslation();
  const availableEngines = listWorkbenchServerImplementedCodeEngines(preferences);
  const selectedEngineId = pane.selectedEngineId;
  const selectedModelId = pane.selectedModelId;
  const mode = pane.mode;
  const selectedEngine =
    findWorkbenchCodeEngineDefinition(selectedEngineId, preferences) ??
    availableEngines[0] ??
    null;
  const modelOptions = selectedEngine?.modelCatalog ?? [];

  const updatePane = (updates: Partial<MultiWindowPaneConfig>) => {
    onChange({
      ...pane,
      ...updates,
    });
  };

  const updateParameters = (updates: Partial<MultiWindowPaneConfig['parameters']>) => {
    updatePane({
      parameters: createDefaultMultiWindowModelParameters({
        ...pane.parameters,
        ...updates,
      }),
    });
  };

  const handleEngineChange = (engineId: string) => {
    const nextEngine = findWorkbenchCodeEngineDefinition(engineId, preferences) ?? selectedEngine;
    if (!nextEngine) {
      return;
    }

    updatePane({
      selectedEngineId: nextEngine.id,
      selectedModelId: resolveWorkbenchCodeEngineSelectedModelId(nextEngine.id, preferences),
    });
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedEngine) {
      return;
    }

    updatePane({
      selectedModelId: normalizeWorkbenchCodeModelId(selectedEngine.id, modelId, preferences),
    });
  };

  const handleModeChange = (nextMode: MultiWindowPaneMode) => {
    updatePane({ mode: nextMode });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-[#101114] px-3 py-2 text-[11px] font-medium text-gray-300">
        <span>{t('multiWindow.enabled')}</span>
        <input
          checked={pane.enabled}
          className="h-4 w-4 accent-blue-500"
          type="checkbox"
          onChange={(event) => updatePane({ enabled: event.target.checked })}
        />
      </label>

      <label className="block text-[11px] font-medium text-gray-500">
        {t('multiWindow.provider')}
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
          value={selectedEngineId}
          onChange={(event) => handleEngineChange(event.target.value)}
        >
          {availableEngines.map((engine) => (
            <option key={engine.id} value={engine.id}>
              {engine.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[11px] font-medium text-gray-500">
        {t('multiWindow.model')}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#101114]">
            <WorkbenchCodeEngineIcon engineId={selectedEngineId} />
          </div>
          <select
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
            value={selectedModelId}
            onChange={(event) => handleModelChange(event.target.value)}
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      </label>

      <label className="block text-[11px] font-medium text-gray-500">
        {t('multiWindow.mode')}
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
          value={mode}
          onChange={(event) => handleModeChange(event.target.value as MultiWindowPaneMode)}
        >
          <option value="chat">{t('multiWindow.chatMode')}</option>
          <option value="preview">{t('multiWindow.previewMode')}</option>
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block text-[11px] font-medium text-gray-500">
          {t('multiWindow.temperature')}
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
            max={2}
            min={0}
            onChange={(event) => updateParameters({ temperature: Number(event.target.value) })}
            step={0.1}
            type="number"
            value={pane.parameters.temperature}
          />
        </label>
        <label className="block text-[11px] font-medium text-gray-500">
          {t('multiWindow.topP')}
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
            max={1}
            min={0}
            onChange={(event) => updateParameters({ topP: Number(event.target.value) })}
            step={0.05}
            type="number"
            value={pane.parameters.topP}
          />
        </label>
        <label className="block text-[11px] font-medium text-gray-500">
          {t('multiWindow.maxOutputTokens')}
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs text-gray-200 outline-none focus:border-blue-400/50"
            min={256}
            onChange={(event) => updateParameters({ maxOutputTokens: Number(event.target.value) })}
            step={256}
            type="number"
            value={pane.parameters.maxOutputTokens}
          />
        </label>
      </div>

      <label className="block text-[11px] font-medium text-gray-500">
        {t('multiWindow.systemPrompt')}
        <textarea
          className="mt-1 min-h-20 w-full resize-none rounded-md border border-white/10 bg-[#101114] px-2 py-2 text-xs leading-5 text-gray-200 outline-none focus:border-blue-400/50"
          onChange={(event) => updateParameters({ systemPrompt: event.target.value })}
          value={pane.parameters.systemPrompt}
        />
      </label>
    </div>
  );
});

MultiWindowPaneConfigurationForm.displayName = 'MultiWindowPaneConfigurationForm';
