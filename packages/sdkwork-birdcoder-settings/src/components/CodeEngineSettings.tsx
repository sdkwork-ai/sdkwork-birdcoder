import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  hasWorkbenchCodeModel,
  listWorkbenchCodeEngines,
  resolveWorkbenchServerEngineSupportState,
} from '@sdkwork/birdcoder-codeengine';

import {
  removeWorkbenchCodeEngineCustomModel,
  setWorkbenchCodeEngineDefaultModel,
  upsertWorkbenchCodeEngineCustomModel,
  useToast,
} from '@sdkwork/birdcoder-commons';
import { Button, WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui';

import type { SettingsProps } from './types';

interface EngineDraftState {
  label: string;
  modelId: string;
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

export function CodeEngineSettings({
  workbenchPreferences,
  updateWorkbenchPreferences,
}: Pick<SettingsProps, 'workbenchPreferences' | 'updateWorkbenchPreferences'>) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [draftByEngineId, setDraftByEngineId] = useState<Record<string, EngineDraftState>>({});

  const engines = useMemo(
    () => listWorkbenchCodeEngines(workbenchPreferences),
    [workbenchPreferences],
  );

  if (!workbenchPreferences || !updateWorkbenchPreferences) {
    return null;
  }

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

  return (
    <>
      <h2 className="text-xl font-semibold text-white mb-4">{t('settings.engines.title')}</h2>
      <div className="mb-4 text-sm text-gray-400">{t('settings.engines.description')}</div>
      <div className="space-y-4">
        {engines.map((engine) => {
          const draft = draftByEngineId[engine.id] ?? { label: '', modelId: '' };
          const engineSupport = resolveWorkbenchServerEngineSupportState(
            engine.id,
            workbenchPreferences,
          );
          const primaryLane = engine.primaryAccessLane;
          const fallbackLanes = engine.accessPlan?.fallbackLaneIds
            .map((laneId) => engine.accessPlan?.lanes.find((lane) => lane.laneId === laneId))
            .filter((lane): lane is NonNullable<typeof primaryLane> => !!lane);
          return (
            <div
              key={engine.id}
              className="rounded-xl border border-white/10 bg-[#18181b] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex items-start gap-3">
                  <WorkbenchCodeEngineIcon engineId={engine.id} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium">{engine.label}</div>
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {engine.vendor}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          engineSupport.implemented
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {engineSupport.implemented
                          ? t('settings.engines.serverReady')
                          : t('settings.engines.serverPlanned')}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">{engine.description}</div>
                    {primaryLane ? (
                      <div className="mt-3 grid gap-2 text-xs text-gray-400 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('settings.engines.primaryLane')}
                          </div>
                          <div className="mt-1 font-medium text-gray-200">{primaryLane.label}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('settings.engines.strategy')}
                          </div>
                          <div className="mt-1 font-medium text-gray-200">
                            {formatStrategyLabel(t, primaryLane.strategyKind)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('settings.engines.runtimeOwner')}
                          </div>
                          <div className="mt-1 font-medium text-gray-200">
                            {formatRuntimeOwnerLabel(t, primaryLane.runtimeOwner)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500">
                            {t('settings.engines.bridgeProtocol')}
                          </div>
                          <div className="mt-1 font-medium text-gray-200">
                            {formatBridgeProtocolLabel(t, primaryLane.bridgeProtocol)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="w-full max-w-sm">
                  <div className="mb-1 text-sm font-medium text-white">
                    {t('settings.engines.defaultModel')}
                  </div>
                  <div className="mb-2 text-xs text-gray-500">
                    {t('settings.engines.defaultModelDesc')}
                  </div>
                  <select
                    value={engine.defaultModelId}
                    onChange={(event) => {
                      updateWorkbenchPreferences((previousState) =>
                        setWorkbenchCodeEngineDefaultModel(
                          previousState,
                          engine.id,
                          event.target.value,
                        ),
                      );
                      addToast(
                        t('settings.engines.defaultModelUpdated', {
                          engine: engine.label,
                        }),
                        'success',
                      );
                    }}
                    className="w-full appearance-none rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-gray-500 focus:border-blue-500"
                  >
                    {engine.modelCatalog.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {engine.accessPlan?.lanes.length ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-[#141417] p-4">
                  <div className="mb-3 text-sm font-medium text-white">
                    {t('settings.engines.deliveryLanes')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {engine.accessPlan.lanes.map((lane) => (
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
                          {formatTransportLabel(lane.transportKind)} ·{' '}
                          {formatStrategyLabel(t, lane.strategyKind)}
                        </div>
                        <div className="mt-1 text-gray-500">{lane.description}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    {t('settings.engines.fallbackLanes')}:{' '}
                    {fallbackLanes && fallbackLanes.length > 0
                      ? fallbackLanes.map((lane) => lane.label).join(' / ')
                      : t('settings.engines.none')}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {engine.modelCatalog.map((model) => (
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
                              engine.id,
                              model.id,
                            ),
                          );
                          addToast(
                            t('settings.engines.modelRemoved', {
                              engine: engine.label,
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
                    value={draft.modelId}
                    onChange={(event) => updateDraft(engine.id, 'modelId', event.target.value)}
                    placeholder={t('settings.engines.modelIdPlaceholder')}
                    className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 hover:border-gray-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={draft.label}
                    onChange={(event) => updateDraft(engine.id, 'label', event.target.value)}
                    placeholder={t('settings.engines.modelLabelPlaceholder')}
                    className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 hover:border-gray-500 focus:border-blue-500"
                  />
                  <Button
                    size="sm"
                    className="h-10 gap-2"
                    disabled={!draft.modelId.trim()}
                    onClick={() => {
                      if (hasWorkbenchCodeModel(engine.id, draft.modelId, workbenchPreferences)) {
                        addToast(
                          t('settings.engines.modelAlreadyExists', {
                            engine: engine.label,
                          }),
                          'info',
                        );
                        return;
                      }

                      updateWorkbenchPreferences((previousState) =>
                        upsertWorkbenchCodeEngineCustomModel(previousState, engine.id, {
                          id: draft.modelId,
                          label: draft.label,
                        }),
                      );
                      clearDraft(engine.id);
                      addToast(
                        t('settings.engines.modelAdded', {
                          engine: engine.label,
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
          );
        })}
      </div>
    </>
  );
}
