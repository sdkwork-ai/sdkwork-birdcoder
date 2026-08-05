import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  loadWorkbenchAgentEngineCatalog,
  normalizeWorkbenchServerImplementedAgentEngineId,
  resolveWorkbenchAgentEngineSelectedModelId,
  useWorkbenchAgentEngineCatalog,
  type WorkbenchAgentEngineId,
  type WorkbenchAgentEngineKind,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentEngineCatalog';
import {
  setWorkbenchActiveAgentEngine,
  setWorkbenchAgentEngineDefaultModel,
  useToast,
} from '@sdkwork/birdcoder-pc-workbench';
import { Button, WorkbenchAgentEngineIcon } from '@sdkwork/birdcoder-pc-ui-shell';

import { AgentEngineConfigFilePanel } from './AgentEngineConfigFilePanel';
import { AgentEngineQuickConfigForm } from './AgentEngineQuickConfigForm';
import type { SettingsProps } from './types';

type AgentEngineSettingsSelectionProps = {
  activeEngineId?: WorkbenchAgentEngineId;
  setActiveEngineId?: (engineId: WorkbenchAgentEngineId) => void;
};

function useSortedAgentEngines() {
  const catalog = useWorkbenchAgentEngineCatalog();
  return useMemo(
    () => [...catalog.engines].sort((left, right) => left.label.localeCompare(right.label)),
    [catalog.engines],
  );
}

const ENGINE_KIND_TONE_CLASSES: Readonly<Record<WorkbenchAgentEngineKind, string>> = {
  code: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  work: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
  simple: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  unknown: 'bg-white/5 text-gray-400 ring-white/10',
};

function engineKindLabelKey(kind: WorkbenchAgentEngineKind): string {
  switch (kind) {
    case 'code':
      return 'settings.engines.kindCode';
    case 'work':
      return 'settings.engines.kindWork';
    case 'simple':
      return 'settings.engines.kindSimple';
    default:
      return 'settings.engines.kindUnknown';
  }
}

function EngineKindBadge({ kind }: { kind: WorkbenchAgentEngineKind }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${ENGINE_KIND_TONE_CLASSES[kind]}`}
    >
      {t(engineKindLabelKey(kind))}
    </span>
  );
}

export function AgentEngineSettingsSidebar({
  workbenchPreferences,
  activeEngineId,
  setActiveEngineId,
}: Pick<SettingsProps, 'workbenchPreferences'> & {
  activeEngineId: WorkbenchAgentEngineId;
  setActiveEngineId: (engineId: WorkbenchAgentEngineId) => void;
}) {
  const { t } = useTranslation();
  const engines = useSortedAgentEngines();
  const defaultEngineId = normalizeWorkbenchServerImplementedAgentEngineId(
    workbenchPreferences?.agentEngineId,
    workbenchPreferences,
  );

  useEffect(() => {
    const fallbackEngineId = engines[0]?.id ?? '';
    if (fallbackEngineId && !engines.some((engine) => engine.id === activeEngineId)) {
      setActiveEngineId(fallbackEngineId);
    }
  }, [activeEngineId, engines, setActiveEngineId]);

  return (
    <aside
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-white/5 bg-[#0e0e11] text-sm"
      aria-label={t('settings.engines.sidebarLabel')}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('settings.engines.sidebarTitle')}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {engines.map((engine) => {
          const isActive = activeEngineId === engine.id;
          const isDefault = defaultEngineId === engine.id;
          return (
            <button
              key={engine.id}
              type="button"
              onClick={() => setActiveEngineId(engine.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                isActive
                  ? 'border-blue-500/40 bg-blue-500/10 text-white'
                  : 'border-white/10 bg-[#141417] text-gray-300 hover:border-white/20 hover:bg-white/5 hover:text-white'
              }`}
            >
              <WorkbenchAgentEngineIcon engineId={engine.id} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{engine.label}</span>
                  {isDefault ? (
                    <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                      {t('settings.engines.defaultBadge')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <EngineKindBadge kind={engine.engineKind} />
                  {engine.available ? (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      {t('settings.engines.modelCount', { count: engine.modelCatalog.length })}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                      {t('settings.engines.unavailableBadge')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function AgentEngineSettings({
  workbenchPreferences,
  updateWorkbenchPreferences,
  activeEngineId: controlledActiveEngineId,
  setActiveEngineId: setControlledActiveEngineId,
}: Pick<SettingsProps, 'workbenchPreferences' | 'updateWorkbenchPreferences'> &
  AgentEngineSettingsSelectionProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const engines = useSortedAgentEngines();
  const [internalActiveEngineId, setInternalActiveEngineId] = useState('');
  const [activeTab, setActiveTab] = useState<'models' | 'config'>('models');
  const activeEngineId = controlledActiveEngineId ?? internalActiveEngineId;
  const setActiveEngineId = setControlledActiveEngineId ?? setInternalActiveEngineId;

  useEffect(() => {
    void loadWorkbenchAgentEngineCatalog().catch((error) => {
      console.warn('[sdkwork-agents] failed to refresh agent-engine catalog:', error);
    });
  }, []);

  const defaultEngineId = normalizeWorkbenchServerImplementedAgentEngineId(
    workbenchPreferences?.agentEngineId,
    workbenchPreferences,
  );
  const activeEngine =
    engines.find((engine) => engine.id === activeEngineId) ?? engines[0] ?? null;

  useEffect(() => {
    if (activeEngine && activeEngine.id !== activeEngineId) {
      setActiveEngineId(activeEngine.id);
    }
  }, [activeEngine, activeEngineId, setActiveEngineId]);

  if (!workbenchPreferences || !updateWorkbenchPreferences) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 bg-[#0e0e11]">
      <AgentEngineSettingsSidebar
        activeEngineId={activeEngine?.id ?? activeEngineId}
        setActiveEngineId={setActiveEngineId}
        workbenchPreferences={workbenchPreferences}
      />
      <div className="min-w-0 flex-1 overflow-y-auto p-12">
        <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
          <h1 className="mb-4 text-2xl font-semibold text-white">{t('settings.engines.title')}</h1>
          <div className="mb-8 text-sm text-gray-400">{t('settings.engines.description')}</div>

          {activeEngine ? (
            <div className="rounded-xl border border-white/10 bg-[#18181b] p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <WorkbenchAgentEngineIcon engineId={activeEngine.id} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{activeEngine.label}</div>
                      <EngineKindBadge kind={activeEngine.engineKind} />
                      {activeEngine.available ? null : (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                          {t('settings.engines.unavailableBadge')}
                        </span>
                      )}
                      {defaultEngineId === activeEngine.id ? (
                        <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                          {t('settings.engines.defaultBadge')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {t('settings.engines.modelCount', { count: activeEngine.models.length })}
                    </div>
                  </div>
                </div>

                <div className="grid w-full gap-3 lg:max-w-sm">
                  {!activeEngine.available ? (
                    <div className="w-full rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-200/90">
                      {t('settings.engines.unavailableReason', {
                        reason: activeEngine.unavailableReason ?? t('settings.engines.unavailableUnknown'),
                      })}
                    </div>
                  ) : defaultEngineId === activeEngine.id ? null : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setActiveEngineId(activeEngine.id);
                        updateWorkbenchPreferences((previousState) =>
                          setWorkbenchActiveAgentEngine(previousState, activeEngine.id),
                        );
                        addToast(
                          t('settings.engines.defaultEngineUpdated', {
                            engine: activeEngine.label,
                          }),
                          'success',
                        );
                      }}
                    >
                      {t('settings.engines.makeDefault')}
                    </Button>
                  )}

                  {!activeEngine.available ? null : (
                  <label className="grid gap-2 text-sm font-medium text-white">
                    {t('settings.engines.defaultModel')}
                    <select
                      value={
                        resolveWorkbenchAgentEngineSelectedModelId(
                          activeEngineId,
                          workbenchPreferences,
                          activeEngine.defaultModelId,
                        )
                      }
                      onChange={(event) => {
                        updateWorkbenchPreferences((previousState) =>
                          setWorkbenchAgentEngineDefaultModel(
                            previousState,
                            activeEngine.id,
                            event.target.value,
                          ),
                        );
                        addToast(
                          t('settings.engines.defaultModelUpdated', {
                            engine: activeEngine.label,
                          }),
                          'success',
                        );
                      }}
                      className="w-full appearance-none rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-gray-500 focus:border-blue-500"
                    >
                      {activeEngine.models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  )}
                </div>
              </div>

              <div
                className="mt-5 flex gap-1 border-b border-white/10"
                role="tablist"
                aria-label={t('settings.engines.detailTabsLabel')}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'models'}
                  onClick={() => setActiveTab('models')}
                  className={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'models'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t('settings.engines.tabModels')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'config'}
                  onClick={() => setActiveTab('config')}
                  className={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'config'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t('settings.engines.tabConfigFile')}
                </button>
              </div>

              {activeTab === 'models' ? (
                <div className="mt-5 grid gap-4">
                  <AgentEngineQuickConfigForm
                    engine={activeEngine}
                    onSaved={() => {
                      void loadWorkbenchAgentEngineCatalog().catch((error) => {
                        console.warn('[sdkwork-agents] failed to refresh agent-engine catalog:', error);
                      });
                    }}
                    onNotify={(message, tone) => addToast(message, tone)}
                  />
                  {activeEngine.available ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeEngine.models.map((model) => (
                        <div
                          key={model.id}
                          className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-3"
                        >
                          <div className="text-sm font-medium text-gray-200">{model.label}</div>
                          <div className="mt-1 text-xs text-gray-500">{model.id}</div>
                          {model.description ? (
                            <div className="mt-2 text-xs leading-5 text-gray-400">
                              {model.description}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5">
                  <AgentEngineConfigFilePanel engine={activeEngine} />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
