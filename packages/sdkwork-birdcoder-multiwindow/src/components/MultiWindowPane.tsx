import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import {
  getWorkbenchCodeEngineSessionSummary,
} from '@sdkwork/birdcoder-codeengine';
import { UniversalChat } from '@sdkwork/birdcoder-ui';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  Monitor,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Settings2,
  Undo2,
  X,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  MultiWindowPaneBinding,
  MultiWindowPaneConfig,
  MultiWindowPaneMode,
  MultiWindowPaneRuntimeStatus,
} from '../types.ts';
import {
  resolveMultiWindowPaneSessionProvisioningStatus,
} from '../runtime/multiWindowSessionProvisioning.ts';
import {
  resolveMultiWindowPaneAutoPreviewUrl,
} from '../runtime/multiWindowPreviewUrl.ts';
import type {
  MultiWindowDispatchPaneResult,
} from '../runtime/multiWindowDispatch.ts';
import type {
  MultiWindowPaneDispatchability,
} from '../runtime/multiWindowDispatchability.ts';
import { MultiWindowPaneSettings } from './MultiWindowPaneSettings.tsx';

interface MultiWindowPaneProps {
  binding: MultiWindowPaneBinding | null;
  canRetryPane?: boolean;
  dispatchability?: MultiWindowPaneDispatchability;
  dispatchResult?: MultiWindowDispatchPaneResult;
  pane: MultiWindowPaneConfig;
  paneIndex: number;
  preferences: WorkbenchPreferences;
  runtimeStatus: MultiWindowPaneRuntimeStatus;
  runtimeStatusMessage?: string;
  onChange: (pane: MultiWindowPaneConfig) => void;
  onClose: () => void;
  onOpenSessionPicker: () => void;
  onRetryPane?: () => void;
}

function normalizePreviewUrl(value: string): string {
  const normalizedValue = value.trim();
  return normalizedValue || 'about:blank';
}

function resolveRuntimeStatusIcon(status: MultiWindowPaneRuntimeStatus) {
  if (status === 'pending') {
    return <Loader2 size={13} className="animate-spin text-blue-300" />;
  }
  if (status === 'success') {
    return <CheckCircle2 size={13} className="text-emerald-300" />;
  }
  if (status === 'failed') {
    return <AlertCircle size={13} className="text-red-300" />;
  }
  if (status === 'cancelled') {
    return <AlertCircle size={13} className="text-amber-300" />;
  }
  return null;
}

export const MultiWindowPane = memo(function MultiWindowPane({
  binding,
  canRetryPane = false,
  dispatchability,
  dispatchResult,
  pane,
  paneIndex,
  preferences,
  runtimeStatus,
  runtimeStatusMessage,
  onChange,
  onClose,
  onOpenSessionPicker,
  onRetryPane,
}: MultiWindowPaneProps) {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const projectName = binding?.project?.name ?? t('multiWindow.noProjectSelected');
  const sessionName = binding?.codingSession?.title ?? t('multiWindow.noSessionSelected');
  const messages = binding?.messages ?? [];
  const sessionProvisioningStatus = resolveMultiWindowPaneSessionProvisioningStatus(
    pane,
    binding?.codingSession,
  );
  const shouldProvisionSession = sessionProvisioningStatus.status === 'needs-session';
  const effectiveEngineId = pane.selectedEngineId || binding?.codingSession?.engineId?.trim() || '';
  const effectiveModelId = pane.selectedModelId || binding?.codingSession?.modelId?.trim() || '';
  const engineSummary = getWorkbenchCodeEngineSessionSummary(
    effectiveEngineId,
    effectiveModelId,
    preferences,
  );
  const manualPreviewUrl = normalizePreviewUrl(pane.previewUrl);
  const autoPreviewUrl = resolveMultiWindowPaneAutoPreviewUrl(messages);
  const previewUrl = manualPreviewUrl !== 'about:blank'
    ? manualPreviewUrl
    : autoPreviewUrl ?? 'about:blank';
  const hasPreviewUrl = previewUrl !== 'about:blank';
  const hasManualPreviewOverride = manualPreviewUrl !== 'about:blank';
  const hasAutoPreviewUrl = manualPreviewUrl === 'about:blank' && Boolean(autoPreviewUrl);
  const hasPaneDispatchMetric =
    Boolean(dispatchResult) &&
    dispatchResult?.status !== 'pending' &&
    dispatchResult?.status !== 'skipped';
  const transcriptSessionScopeKey = useMemo(
    () =>
      pane.projectId && pane.codingSessionId
        ? `${pane.projectId}\u0001${pane.codingSessionId}`
        : pane.id,
    [pane.codingSessionId, pane.id, pane.projectId],
  );

  const handleModeChange = (mode: MultiWindowPaneMode) => {
    onChange({
      ...pane,
      mode,
    });
  };

  return (
    <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#14151a] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onOpenSessionPicker}
          title={t('multiWindow.selectSession')}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 min-w-6 items-center justify-center rounded bg-white/10 text-[11px] font-semibold text-gray-300">
              {paneIndex + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-gray-100">{sessionName}</div>
              <div className="mt-0.5 truncate text-[11px] text-gray-500">{projectName}</div>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {resolveRuntimeStatusIcon(runtimeStatus)}
          {hasPaneDispatchMetric && dispatchResult ? (
            <div
              className="hidden items-center rounded-md bg-white/5 px-1.5 py-1 text-[11px] font-medium text-gray-400 lg:flex"
              title={t('multiWindow.paneDuration', { durationMs: dispatchResult.durationMs })}
            >
              {t('multiWindow.paneDuration', { durationMs: dispatchResult.durationMs })}
            </div>
          ) : null}
          {canRetryPane && onRetryPane ? (
            <button
              type="button"
              className="rounded-md p-1.5 text-red-200 transition-colors hover:bg-red-500/10 hover:text-red-100"
              onClick={() => onRetryPane()}
              title={t('multiWindow.retryPane')}
            >
              <RotateCcw size={14} />
            </button>
          ) : null}
          <div className="hidden items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-gray-400 xl:flex">
            <WorkbenchCodeEngineIcon engineId={effectiveEngineId} />
            <span className="max-w-[120px] truncate">{engineSummary}</span>
          </div>
          {shouldProvisionSession ? (
            <div
              className="hidden items-center rounded-md bg-amber-400/10 px-1.5 py-1 text-amber-200 xl:flex"
              title={t('multiWindow.autoProvisionSession')}
            >
              <PlusCircle size={13} />
            </div>
          ) : null}
          <button
            type="button"
            className={`rounded-md p-1.5 transition-colors ${
              pane.mode === 'chat' ? 'bg-blue-500/10 text-blue-200' : 'text-gray-500 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => handleModeChange('chat')}
            title={t('multiWindow.chatMode')}
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            className={`rounded-md p-1.5 transition-colors ${
              pane.mode === 'preview' ? 'bg-blue-500/10 text-blue-200' : 'text-gray-500 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => handleModeChange('preview')}
            title={t('multiWindow.previewMode')}
          >
            <Monitor size={14} />
          </button>
          <button
            type="button"
            className={`rounded-md p-1.5 transition-colors ${
              isSettingsOpen ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => setIsSettingsOpen((previousState) => !previousState)}
            title={t('multiWindow.settings')}
          >
            <Settings2 size={14} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-200"
            onClick={() => onClose()}
            title={t('multiWindow.closeWindow')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {(runtimeStatus === 'failed' || runtimeStatus === 'cancelled') && runtimeStatusMessage ? (
        <div className={`shrink-0 border-b px-3 py-2 text-[11px] ${
          runtimeStatus === 'failed'
            ? 'border-red-400/10 bg-red-500/10 text-red-200'
            : 'border-amber-400/10 bg-amber-500/10 text-amber-200'
        }`}>
          {runtimeStatusMessage}
        </div>
      ) : null}

      {dispatchability && dispatchability.status === 'not-dispatchable' ? (
        <div className="shrink-0 border-b border-amber-400/10 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          {t(`multiWindow.paneDispatchabilityReason.${dispatchability.reason}`)}
        </div>
      ) : null}

      {pane.mode === 'chat' ? (
        <div className="min-h-0 flex-1">
          <UniversalChat
            className="bg-transparent"
            disabled
            emptyState={
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-gray-500">
                <MessageSquare size={26} className="mb-3 text-gray-600" />
                <span>{pane.codingSessionId ? t('multiWindow.noMessages') : t('multiWindow.bindSessionFirst')}</span>
              </div>
            }
            hideComposer={true}
            isActive
            layout="sidebar"
            messages={messages}
            onSendMessage={() => undefined}
            selectedEngineId={effectiveEngineId}
            selectedModelId={effectiveModelId}
            sessionId={pane.codingSessionId || undefined}
            sessionScopeKey={transcriptSessionScopeKey}
            showComposerEngineSelector={false}
            showEngineHeader={false}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-[#101114]">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.08] px-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#17181d] px-2 py-1.5 text-xs text-gray-200 outline-none placeholder:text-gray-600 focus:border-blue-400/50"
              onChange={(event) => onChange({ ...pane, previewUrl: event.target.value })}
              placeholder={
                autoPreviewUrl
                  ? t('multiWindow.autoPreviewUrlPlaceholder', { url: autoPreviewUrl })
                  : t('multiWindow.previewUrlPlaceholder')
              }
              value={pane.previewUrl === 'about:blank' ? '' : pane.previewUrl}
            />
            {hasAutoPreviewUrl ? (
              <span
                className="hidden rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 xl:inline-flex"
                title={autoPreviewUrl ?? undefined}
              >
                {t('multiWindow.autoPreviewUrl')}
              </span>
            ) : null}
            {hasAutoPreviewUrl ? (
              <button
                type="button"
                className="rounded-md p-1.5 text-emerald-200 transition-colors hover:bg-emerald-500/10 hover:text-emerald-100"
                onClick={() => onChange({ ...pane, previewUrl: autoPreviewUrl ?? 'about:blank' })}
                title={t('multiWindow.useDetectedPreviewUrl')}
              >
                <Link2 size={14} />
              </button>
            ) : null}
            {hasManualPreviewOverride ? (
              <button
                type="button"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => onChange({ ...pane, previewUrl: 'about:blank' })}
                title={t('multiWindow.clearPreviewOverride')}
              >
                <Undo2 size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setPreviewRefreshKey((previousState) => previousState + 1)}
              title={t('multiWindow.refreshPreview')}
            >
              <RefreshCw size={14} />
            </button>
            {hasPreviewUrl ? (
              <button
                type="button"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                title={t('multiWindow.openPreview')}
              >
                <ExternalLink size={14} />
              </button>
            ) : null}
          </div>
          <div
            data-testid="multiwindow-preview-frame"
            className="relative min-h-0 flex-1 bg-[#f7f8fa]"
          >
            {hasPreviewUrl ? (
              <iframe
                key={`${previewUrl}:${previewRefreshKey}`}
                className="h-full w-full border-0 bg-white"
                sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
                src={previewUrl}
                title={t('multiWindow.previewFrameTitle', { index: paneIndex + 1 })}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[#111318] px-6 text-center">
                <Monitor size={30} className="mb-3 text-gray-600" />
                <div className="text-sm font-medium text-gray-300">{t('multiWindow.previewEmptyTitle')}</div>
                <div className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
                  {t('multiWindow.previewEmptyDescription')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isSettingsOpen ? (
        <MultiWindowPaneSettings
          pane={pane}
          preferences={preferences}
          onChange={onChange}
        />
      ) : null}
    </section>
  );
});

MultiWindowPane.displayName = 'MultiWindowPane';
