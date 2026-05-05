import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  hasWorkbenchCodeModel,
  listWorkbenchCodeEngines,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchServerEngineSupportState,
  type WorkbenchCodeEngineId,
} from '@sdkwork/birdcoder-codeengine';
import {
  removeWorkbenchCodeEngineCustomModel,
  setWorkbenchActiveCodeEngine,
  setWorkbenchCodeEngineDefaultModel,
  upsertWorkbenchCodeEngineCustomModel,
  useToast,
} from '@sdkwork/birdcoder-commons';
import { Button, WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';

import type { SettingsProps } from './types';

interface EngineDraftState {
  label: string;
  modelId: string;
}

type CodeEngineSettingsSelectionProps = {
  activeEngineId?: WorkbenchCodeEngineId;
  setActiveEngineId?: (engineId: WorkbenchCodeEngineId) => void;
};

function listSortedWorkbenchCodeEngines(
  workbenchPreferences: SettingsProps['workbenchPreferences'],
) {
  const listedEngines = [...listWorkbenchCodeEngines(workbenchPreferences)];
  listedEngines.sort((left, right) => {
    if (left.id === BIRDCODER_STANDARD_DEFAULT_ENGINE_ID) {
      return -1;
    }
    if (right.id === BIRDCODER_STANDARD_DEFAULT_ENGINE_ID) {
      return 1;
    }
    return left.label.localeCompare(right.label);
  });
  return listedEngines;
}

function formatStrategyLabel(
  t: ReturnType<typeof useTranslation>['t'],
  strategyKind: string,
): string {
  switch (strategyKind) {
    case 'rust-native':
      return t('settings.engines.strategyRustNative');
    case 'grpc-bridge':
      return t('settings.engines.strategyGrpcBridge');
    case 'openapi-proxy':
      return t('settings.engines.strategyOpenApiProxy');
    case 'remote-control':
      return t('settings.engines.strategyRemoteControl');
    case 'cli-spawn':
      return t('settings.engines.strategyCliSpawn');
    default:
      return strategyKind;
  }
}

function formatRuntimeOwnerLabel(
  t: ReturnType<typeof useTranslation>['t'],
  runtimeOwner: string,
): string {
  switch (runtimeOwner) {
    case 'rust-server':
      return t('settings.engines.runtimeOwnerRustServer');
    case 'typescript-bridge':
      return t('settings.engines.runtimeOwnerTypescriptBridge');
    case 'external-service':
      return t('settings.engines.runtimeOwnerExternalService');
    default:
      return runtimeOwner;
  }
}

function formatRuntimeModeLabel(
  t: ReturnType<typeof useTranslation>['t'],
  runtimeMode: string,
): string {
  switch (runtimeMode) {
    case 'sdk':
      return t('settings.engines.runtimeModeSdk');
    case 'headless':
      return t('settings.engines.runtimeModeHeadless');
    case 'remote-control':
      return t('settings.engines.runtimeModeRemoteControl');
    case 'protocol-fallback':
      return t('settings.engines.runtimeModeProtocolFallback');
    default:
      return runtimeMode;
  }
}

function formatAuthorityPathLabel(
  t: ReturnType<typeof useTranslation>['t'],
  authorityPath: string,
): string {
  switch (authorityPath) {
    case 'rust-native':
      return t('settings.engines.authorityPathRustNative');
    case 'rust-rpc-bridge':
      return t('settings.engines.authorityPathRustRpcBridge');
    case 'typescript-rpc-bridge':
      return t('settings.engines.authorityPathTypescriptRpcBridge');
    case 'external-service':
      return t('settings.engines.authorityPathExternalService');
    case 'unknown':
      return t('settings.engines.authorityPathUnknown');
    default:
      return authorityPath;
  }
}

function formatBridgeProtocolLabel(
  t: ReturnType<typeof useTranslation>['t'],
  bridgeProtocol: string,
): string {
  switch (bridgeProtocol) {
    case 'direct':
      return t('settings.engines.bridgeProtocolDirect');
    case 'grpc':
      return t('settings.engines.bridgeProtocolGrpc');
    case 'http':
      return t('settings.engines.bridgeProtocolHttp');
    case 'websocket':
      return t('settings.engines.bridgeProtocolWebsocket');
    case 'stdio':
      return t('settings.engines.bridgeProtocolStdio');
    default:
      return bridgeProtocol;
  }
}

function formatTransportLabel(transportKind: string): string {
  return transportKind
    .split('-')
    .map((fragment) => fragment.toUpperCase())
    .join(' / ');
}

export function CodeEngineSettingsSidebar({
  workbenchPreferences,
  activeEngineId,
  setActiveEngineId,
}: Pick<SettingsProps, 'workbenchPreferences'> & {
  activeEngineId: WorkbenchCodeEngineId;
  setActiveEngineId: (engineId: WorkbenchCodeEngineId) => void;
}) {
  const { t } = useTranslation();
  const engines = useMemo(
    () => listSortedWorkbenchCodeEngines(workbenchPreferences),
    [workbenchPreferences],
  );
  const workspaceDefaultEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    workbenchPreferences?.codeEngineId,
    workbenchPreferences,
  );
  const fallbackActiveEngineId =
    engines.find((engine) => engine.id === BIRDCODER_STANDARD_DEFAULT_ENGINE_ID)?.id ??
    engines[0]?.id ??
    BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;

  useEffect(() => {
    if (!engines.some((engine) => engine.id === activeEngineId)) {
      setActiveEngineId(fallbackActiveEngineId);
    }
  }, [activeEngineId, engines, fallbackActiveEngineId, setActiveEngineId]);

  return (
    <aside
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-white/5 bg-[#0e0e11] text-sm"
      aria-label={t('settings.engines.sidebarLabel')}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('settings.engines.sidebarTitle')}
        </div>
        <div className="mt-2 text-sm leading-5 text-gray-400">
          {t('settings.engines.description')}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {engines.map((engine) => {
          const engineSupport = resolveWorkbenchServerEngineSupportState(
            engine.id,
            workbenchPreferences,
          );
          const isActive = activeEngineId === engine.id;
          const isWorkspaceDefault = workspaceDefaultEngineId === engine.id;
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
              <WorkbenchCodeEngineIcon engineId={engine.id} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{engine.label}</span>
                  {isWorkspaceDefault ? (
                    <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                      {t('settings.engines.workspaceDefaultBadge')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-xs text-gray-500">{engine.vendor}</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide">
                  <span
                    className={`rounded px-2 py-0.5 font-medium ${
                      engineSupport.implemented
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {engineSupport.implemented
                      ? t('settings.engines.serverReady')
                      : t('settings.engines.serverPlanned')}
                  </span>
                  <span className="text-gray-500">
                    {t('settings.engines.modelCount', {
                      count: engine.modelCatalog.length,
                    })}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function CodeEngineSettings({
  workbenchPreferences,
  updateWorkbenchPreferences,
  activeEngineId: controlledActiveEngineId,
  setActiveEngineId: setControlledActiveEngineId,
}: Pick<SettingsProps, 'workbenchPreferences' | 'updateWorkbenchPreferences'> &
  CodeEngineSettingsSelectionProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [draftByEngineId, setDraftByEngineId] = useState<Record<string, EngineDraftState>>({});
  const [internalActiveEngineId, setInternalActiveEngineId] = useState(
    BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  );
  const activeEngineId = controlledActiveEngineId ?? internalActiveEngineId;
  const setActiveEngineId = setControlledActiveEngineId ?? setInternalActiveEngineId;

  const engines = useMemo(() => {
    return listSortedWorkbenchCodeEngines(workbenchPreferences);
  }, [workbenchPreferences]);

  const workspaceDefaultEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    workbenchPreferences?.codeEngineId,
    workbenchPreferences,
  );
  const workspaceDefaultEngine = engines.find((engine) => engine.id === workspaceDefaultEngineId);

  const fallbackActiveEngineId =
    engines.find((engine) => engine.id === BIRDCODER_STANDARD_DEFAULT_ENGINE_ID)?.id ??
    engines[0]?.id ??
    BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;

  useEffect(() => {
    if (!engines.some((engine) => engine.id === activeEngineId)) {
      setActiveEngineId(fallbackActiveEngineId);
    }
  }, [activeEngineId, engines, fallbackActiveEngineId, setActiveEngineId]);

  const activeEngine =
    engines.find((engine) => engine.id === activeEngineId) ??
    engines.find((engine) => engine.id === fallbackActiveEngineId) ??
    null;

  if (!activeEngine) {
    return null;
  }

  const activeEngineSupport = resolveWorkbenchServerEngineSupportState(
    activeEngine.id,
    workbenchPreferences,
  );
  const activeTopology = activeEngine.executionTopology;
  const activePrimaryLane = activeTopology.primaryLane;
  const activeFallbackLanes = activeTopology.fallbackLanes;
  const activeOfficialIntegration = activeTopology.officialIntegration;
  const activeDraft = draftByEngineId[activeEngine.id] ?? { label: '', modelId: '' };

  const updateDraft = (
    engineId: string,
    key: keyof EngineDraftState,
    value: string,
  ) => {
    setDraftByEngineId((previousState) => ({
      ...previousState,
      [engineId]: {
        label: previousState[engineId]?.label ?? '',
        modelId: previousState[engineId]?.modelId ?? '',
        [key]: value,
      },
    }));
  };

  const clearDraft = (engineId: string) => {
    setDraftByEngineId((previousState) => ({
      ...previousState,
      [engineId]: {
        label: '',
        modelId: '',
      },
    }));
  };

  if (!workbenchPreferences || !updateWorkbenchPreferences) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 bg-[#0e0e11]">
      <CodeEngineSettingsSidebar
        activeEngineId={activeEngine.id}
        setActiveEngineId={setActiveEngineId}
        workbenchPreferences={workbenchPreferences}
      />
      <div className="min-w-0 flex-1 overflow-y-auto p-12">
        <div className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
          <h1 className="mb-4 text-2xl font-semibold text-white">{t('settings.engines.title')}</h1>
          <div className="mb-8 text-sm text-gray-400">{t('settings.engines.description')}</div>

          <div className="rounded-xl border border-white/10 bg-[#18181b] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex items-start gap-3">
                <WorkbenchCodeEngineIcon engineId={activeEngine.id} size="md" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-white font-medium">{activeEngine.label}</div>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {activeEngine.vendor}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        activeEngineSupport.implemented
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {activeEngineSupport.implemented
                        ? t('settings.engines.serverReady')
                        : t('settings.engines.serverPlanned')}
                    </span>
                    {workspaceDefaultEngineId === activeEngine.id ? (
                      <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                        {t('settings.engines.workspaceDefaultBadge')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">{activeEngine.description}</div>
                </div>
              </div>

              <div className="grid w-full gap-3 lg:max-w-sm">
                <div className="rounded-xl border border-white/10 bg-[#141417] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-white">
                      {t('settings.engines.workspaceDefaultEngine')}
                    </div>
                    {workspaceDefaultEngineId === activeEngine.id ? (
                      <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                        {t('settings.engines.workspaceDefaultBadge')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-gray-500">
                    {t('settings.engines.workspaceDefaultSummary', {
                      engine: workspaceDefaultEngine?.label ?? workspaceDefaultEngineId,
                    })}
                  </div>
                  {workspaceDefaultEngineId === activeEngine.id ? null : (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      disabled={!activeEngineSupport.implemented}
                      onClick={() => {
                        if (!activeEngineSupport.implemented) {
                          return;
                        }

                        const nextEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
                          activeEngine.id,
                          workbenchPreferences,
                        );
                        setActiveEngineId(nextEngineId);
                        updateWorkbenchPreferences((previousState) =>
                          setWorkbenchActiveCodeEngine(previousState, nextEngineId),
                        );
                        addToast(
                          t('settings.engines.workspaceDefaultEngineUpdated', {
                            engine: activeEngine.label,
                          }),
                          'success',
                        );
                      }}
                    >
                      {t('settings.engines.makeWorkspaceDefault')}
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-[#141417] p-4">
                  <div className="mb-1 text-sm font-medium text-white">
                    {t('settings.engines.defaultModel')}
                  </div>
                  <div className="mb-2 text-xs text-gray-500">
                    {t('settings.engines.defaultModelDesc')}
                  </div>
                  <select
                    value={activeEngine.defaultModelId}
                    onChange={(event) => {
                      updateWorkbenchPreferences((previousState) =>
                        setWorkbenchCodeEngineDefaultModel(
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
                    {activeEngine.modelCatalog.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {activePrimaryLane ? (
              <div className="mt-4 grid gap-2 text-xs text-gray-400 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.primaryLane')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">{activePrimaryLane.label}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.authorityPath')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">
                    {formatAuthorityPathLabel(t, activeTopology.authorityPath)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.runtimeMode')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">
                    {activeOfficialIntegration
                      ? formatRuntimeModeLabel(t, activeOfficialIntegration.runtimeMode)
                      : t('settings.engines.none')}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.strategy')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">
                    {formatStrategyLabel(t, activePrimaryLane.strategyKind)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.runtimeOwner')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">
                    {formatRuntimeOwnerLabel(t, activePrimaryLane.runtimeOwner)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.bridgeProtocol')}
                  </div>
                  <div className="mt-1 font-medium text-gray-200">
                    {formatBridgeProtocolLabel(t, activePrimaryLane.bridgeProtocol)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {t('settings.engines.officialSdkPackage')}
                  </div>
                  <div className="mt-1 truncate font-medium text-gray-200">
                    {activeTopology.officialSdkPackageName ?? t('settings.engines.none')}
                  </div>
                </div>
              </div>
            ) : null}

            {activeOfficialIntegration?.notes ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141417] p-4 text-xs text-gray-400">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t('settings.engines.integrationNotes')}
                </div>
                <div className="mt-2 leading-6 text-gray-300">{activeOfficialIntegration.notes}</div>
              </div>
            ) : null}

            {activeEngine.accessPlan?.lanes.length ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141417] p-4">
                <div className="mb-3 text-sm font-medium text-white">
                  {t('settings.engines.deliveryLanes')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeEngine.accessPlan.lanes.map((lane) => (
                    <div
                      key={lane.laneId}
                      className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-xs text-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lane.label}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            lane.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {lane.status === 'ready'
                            ? t('settings.engines.serverReady')
                            : t('settings.engines.serverPlanned')}
                        </span>
                      </div>
                      <div className="mt-1 text-gray-500">
                        {formatTransportLabel(lane.transportKind)} {' - '}
                        {formatStrategyLabel(t, lane.strategyKind)}
                      </div>
                      <div className="mt-1 text-gray-500">{lane.description}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {t('settings.engines.fallbackLanes')}:{' '}
                  {activeFallbackLanes.length > 0
                    ? activeFallbackLanes.map((lane) => lane.label).join(' / ')
                    : t('settings.engines.none')}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {activeEngine.modelCatalog.map((model) => (
                <div
                  key={model.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-xs text-gray-200"
                >
                  <span className="font-medium">{model.label}</span>
                  <span className="text-gray-500">{model.id}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      model.source === 'custom'
                        ? 'bg-violet-500/10 text-violet-300'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {model.source === 'custom'
                      ? t('settings.engines.customModel')
                      : t('settings.engines.builtInModel')}
                  </span>
                  {model.source === 'custom' ? (
                    <button
                      type="button"
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title={t('settings.engines.removeCustomModel')}
                      onClick={() => {
                        updateWorkbenchPreferences((previousState) =>
                          removeWorkbenchCodeEngineCustomModel(
                            previousState,
                            activeEngine.id,
                            model.id,
                          ),
                        );
                        addToast(
                          t('settings.engines.modelRemoved', {
                            engine: activeEngine.label,
                          }),
                          'success',
                        );
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-[#0e0e11]/70 p-4">
              <div className="mb-2 text-sm font-medium text-white">
                {t('settings.engines.addCustomModel')}
              </div>
              <div className="mb-4 text-xs text-gray-500">
                {t('settings.engines.addCustomModelDesc')}
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto]">
                <input
                  type="text"
                  value={activeDraft.modelId}
                  onChange={(event) =>
                    updateDraft(activeEngine.id, 'modelId', event.target.value)
                  }
                  placeholder={t('settings.engines.modelIdPlaceholder')}
                  className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 hover:border-gray-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  value={activeDraft.label}
                  onChange={(event) =>
                    updateDraft(activeEngine.id, 'label', event.target.value)
                  }
                  placeholder={t('settings.engines.modelLabelPlaceholder')}
                  className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 hover:border-gray-500 focus:border-blue-500"
                />
                <Button
                  size="sm"
                  className="h-10 gap-2"
                  disabled={!activeDraft.modelId.trim()}
                  onClick={() => {
                    if (
                      hasWorkbenchCodeModel(
                        activeEngine.id,
                        activeDraft.modelId,
                        workbenchPreferences,
                      )
                    ) {
                      addToast(
                        t('settings.engines.modelAlreadyExists', {
                          engine: activeEngine.label,
                        }),
                        'info',
                      );
                      return;
                    }

                    updateWorkbenchPreferences((previousState) =>
                      upsertWorkbenchCodeEngineCustomModel(previousState, activeEngine.id, {
                        id: activeDraft.modelId,
                        label: activeDraft.label,
                      }),
                    );
                    clearDraft(activeEngine.id);
                    addToast(
                      t('settings.engines.modelAdded', {
                        engine: activeEngine.label,
                      }),
                      'success',
                    );
                  }}
                >
                  <Plus size={14} />
                  {t('settings.engines.addModel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
