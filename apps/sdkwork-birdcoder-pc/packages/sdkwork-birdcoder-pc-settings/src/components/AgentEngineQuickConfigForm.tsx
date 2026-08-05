import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getBirdCoderAgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/agentsSdkClients';
import { AgentsSdkModelConfigurationService } from '@sdkwork/birdcoder-pc-infrastructure/services/agentsModelConfigurationService';
import {
  AGENT_MODEL_PROVIDER_IDS,
  type AgentModelProviderId,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAgentModelConfigurationService';
import type { ApplyAgentModelConfigurationInput } from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAgentModelConfigurationService';
import type { WorkbenchAgentEngineDefinition } from '@sdkwork/birdcoder-pc-workbench/workbench/agentEngineCatalog';

const CONFIGURATION_ID_PREFIX = 'model.agent-engine.quick';

function toAgentModelProviderId(engineId: string): AgentModelProviderId | null {
  return (AGENT_MODEL_PROVIDER_IDS as readonly string[]).includes(engineId)
    ? (engineId as AgentModelProviderId)
    : null;
}

const inputClassName =
  'w-full rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-gray-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-45';

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

interface AgentEngineQuickConfigFormProps {
  engine: WorkbenchAgentEngineDefinition;
  onSaved?: () => void;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

export function AgentEngineQuickConfigForm({
  engine,
  onSaved,
  onNotify,
}: AgentEngineQuickConfigFormProps) {
  const { t } = useTranslation();
  const defaultModelId = useMemo(
    () => engine.models.find((model) => model.defaultForEngine)?.id ?? engine.models[0]?.id ?? '',
    [engine],
  );
  const [vendorCode, setVendorCode] = useState('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(defaultModelId);
  const [inputContextTokens, setInputContextTokens] = useState('');
  const [outputContextTokens, setOutputContextTokens] = useState('');
  const [toolCallRounds, setToolCallRounds] = useState('');
  const [supportsMultimodal, setSupportsMultimodal] = useState(false);
  const [saving, setSaving] = useState(false);

  const service = useMemo(
    () => new AgentsSdkModelConfigurationService(getBirdCoderAgentsAppSdkClient()),
    [],
  );

  const saveConfiguration = async (): Promise<void> => {
    if (!modelId.trim() || !baseUrl.trim()) {
      onNotify(t('settings.engines.quickConfigMissingFields'), 'error');
      return;
    }
    const providerId = toAgentModelProviderId(engine.id);
    if (!providerId) {
      onNotify(t('settings.engines.quickConfigUnavailable'), 'error');
      return;
    }
    setSaving(true);
    try {
      const input: ApplyAgentModelConfigurationInput = {
        configurationId: `${CONFIGURATION_ID_PREFIX}.${engine.id}.${modelId.trim()}`,
        engineId: providerId,
        vendorCode: vendorCode.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/u, ''),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        defaultModelId: modelId.trim(),
        supportedModelIds: [modelId.trim()],
        supportedProviderIds: [providerId],
        ...(parsePositiveInteger(inputContextTokens)
          ? { inputContextTokens: parsePositiveInteger(inputContextTokens) }
          : {}),
        ...(parsePositiveInteger(outputContextTokens)
          ? { outputContextTokens: parsePositiveInteger(outputContextTokens) }
          : {}),
        ...(parsePositiveInteger(toolCallRounds)
          ? { toolCallRounds: parsePositiveInteger(toolCallRounds) }
          : {}),
        supportsMultimodal,
      };
      await service.apply(input);
      onNotify(t('settings.engines.quickConfigSaved'), 'success');
      onSaved?.();
    } catch (error) {
      onNotify(
        t('settings.engines.quickConfigSaveFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!engine.available) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
        {t('settings.engines.quickConfigUnavailable')}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-[#18181b] p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">
          {t('settings.engines.quickConfigTitle')}
        </div>
        <div className="text-xs text-gray-500">{t('settings.engines.quickConfigHint')}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigVendor')}
          <input
            className={inputClassName}
            value={vendorCode}
            onChange={(event) => setVendorCode(event.target.value)}
            placeholder="openai-compatible"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigBaseUrl')}
          <input
            className={inputClassName}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://models.example.test/v1"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigApiKey')}
          <input
            className={inputClassName}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t('settings.engines.quickConfigApiKeyPlaceholder')}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigModelId')}
          <input
            className={inputClassName}
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder={defaultModelId}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigInputTokens')}
          <input
            className={inputClassName}
            type="number"
            min={1}
            value={inputContextTokens}
            onChange={(event) => setInputContextTokens(event.target.value)}
            placeholder="128000"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigOutputTokens')}
          <input
            className={inputClassName}
            type="number"
            min={1}
            value={outputContextTokens}
            onChange={(event) => setOutputContextTokens(event.target.value)}
            placeholder="16000"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-gray-300">
          {t('settings.engines.quickConfigToolCallRounds')}
          <input
            className={inputClassName}
            type="number"
            min={1}
            value={toolCallRounds}
            onChange={(event) => setToolCallRounds(event.target.value)}
            placeholder="32"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-medium text-gray-300">
          <input
            type="checkbox"
            checked={supportsMultimodal}
            onChange={(event) => setSupportsMultimodal(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#0e0e11] accent-blue-500"
          />
          {t('settings.engines.quickConfigMultimodal')}
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveConfiguration()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving
            ? t('settings.engines.quickConfigSaving')
            : t('settings.engines.quickConfigSave')}
        </button>
      </div>
    </div>
  );
}
