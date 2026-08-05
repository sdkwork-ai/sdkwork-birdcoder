import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CodeEditor } from '@sdkwork/birdcoder-pc-ui';
import type { WorkbenchAgentEngineId } from '@sdkwork/birdcoder-pc-workbench/workbench/agentEngineCatalog';
import {
  fetchBirdCoderAgentEngineConfigFile,
  type BirdCoderAgentEngineConfigFile,
  type BirdCoderAgentEngineConfigFormat,
} from '@sdkwork/birdcoder-pc-infrastructure/services/agentsCatalogService';

function monacoLanguageForFormat(format: BirdCoderAgentEngineConfigFormat): string {
  switch (format) {
    case 'toml':
      return 'ini';
    case 'json':
      return 'json';
    case 'env':
      return 'properties';
    default:
      return 'plaintext';
  }
}

interface AgentEngineConfigFilePanelProps {
  engine: {
    id: WorkbenchAgentEngineId;
    available: boolean;
    unavailableReason?: string;
  };
}

export function AgentEngineConfigFilePanel({ engine }: AgentEngineConfigFilePanelProps) {
  const { t } = useTranslation();
  const [configFile, setConfigFile] = useState<BirdCoderAgentEngineConfigFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConfigFile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const file = await fetchBirdCoderAgentEngineConfigFile(engine.id);
      setConfigFile(file);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [engine.id]);

  useEffect(() => {
    setConfigFile(null);
    setLoadError(null);
    if (engine.available) {
      void loadConfigFile();
    }
  }, [engine.available, loadConfigFile]);

  const copyContent = useCallback(async () => {
    if (!configFile?.content) {
      return;
    }
    await navigator.clipboard.writeText(configFile.content);
  }, [configFile]);

  if (!engine.available) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
        {t('settings.engines.configFileUnavailable', {
          reason: engine.unavailableReason ?? t('settings.engines.unavailableUnknown'),
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-white/10 bg-[#0e0e11] px-4 py-12 text-sm text-gray-400">
        {t('settings.engines.configFileLoading')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        <div>{t('settings.engines.configFileLoadError')}</div>
        <div className="text-xs text-red-300/70">{loadError}</div>
        <button
          type="button"
          onClick={() => void loadConfigFile()}
          className="self-start rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
        >
          {t('settings.engines.refreshConfigFile')}
        </button>
      </div>
    );
  }

  if (!configFile?.exists) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0e0e11] px-4 py-8 text-center text-sm text-gray-400">
        <div>{t('settings.engines.configFileMissing')}</div>
        <button
          type="button"
          onClick={() => void loadConfigFile()}
          className="self-center rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
        >
          {t('settings.engines.refreshConfigFile')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-gray-400">
            {configFile.configFilePath || t('settings.engines.configFileUnknownPath')}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-300">
            {configFile.format}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadConfigFile()}
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
          >
            {t('settings.engines.refreshConfigFile')}
          </button>
          <button
            type="button"
            onClick={() => void copyContent()}
            disabled={!configFile.content}
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t('settings.engines.copyConfigFile')}
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/10">
        <CodeEditor
          language={monacoLanguageForFormat(configFile.format)}
          path={`agent-engine-${configFile.engineId}-config`}
          readOnly
          showToolbar={false}
          showLanguageBadge={false}
          value={configFile.content || t('settings.engines.configFileEmpty')}
        />
      </div>
    </div>
  );
}
