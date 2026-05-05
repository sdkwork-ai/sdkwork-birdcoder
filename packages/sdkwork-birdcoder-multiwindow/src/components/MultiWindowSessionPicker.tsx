import {
  formatBirdCoderSessionDisplayTime,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import {
  Check,
  Clock3,
  Cpu,
  FolderOpen,
  Hash,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  MultiWindowPaneConfig,
} from '../types.ts';
import { MultiWindowPaneConfigurationForm } from './MultiWindowPaneConfigurationForm.tsx';

type SessionPickerMode = 'select' | 'create';

interface MultiWindowSessionPickerAddProgress {
  currentWindowNumber: number;
  remainingWindowCount: number;
  targetWindowCount: number;
}

interface MultiWindowSessionPickerProps {
  addProgress?: MultiWindowSessionPickerAddProgress | null;
  isCreatingSession: boolean;
  pane: MultiWindowPaneConfig;
  preferences: WorkbenchPreferences;
  projects: readonly BirdCoderProject[];
  selectedCodingSessionId: string;
  selectedProjectId: string;
  onClose: () => void;
  onCreateSession: (projectId: string) => void;
  onPaneChange: (pane: MultiWindowPaneConfig) => void;
  onSelectSession: (projectId: string, codingSessionId: string) => void;
  onStopPendingAddSequence?: () => void;
}

function formatShortSessionId(sessionId: string): string {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId.length <= 12) {
    return normalizedSessionId || '-';
  }

  return `${normalizedSessionId.slice(0, 6)}...${normalizedSessionId.slice(-4)}`;
}

function formatSessionToken(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.replace(/[_-]+/g, ' ');
}

function resolveProjectDetail(project: BirdCoderProject | null): string {
  if (!project) {
    return '-';
  }

  return project.path || project.sitePath || project.domainPrefix || project.id;
}

function resolveSessionActivityLabel(codingSession: BirdCoderCodingSession): string {
  return (
    codingSession.displayTime ||
    formatBirdCoderSessionDisplayTime(
      codingSession.transcriptUpdatedAt || codingSession.lastTurnAt || codingSession.updatedAt,
      codingSession.createdAt,
    )
  );
}

function buildSessionSearchText(codingSession: BirdCoderCodingSession): string {
  return [
    codingSession.title,
    codingSession.id,
    codingSession.engineId,
    codingSession.modelId,
    codingSession.status,
    codingSession.runtimeStatus,
    codingSession.hostMode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export const MultiWindowSessionPicker = memo(function MultiWindowSessionPicker({
  addProgress = null,
  isCreatingSession,
  pane,
  preferences,
  projects,
  selectedCodingSessionId,
  selectedProjectId,
  onClose,
  onCreateSession,
  onPaneChange,
  onSelectSession,
  onStopPendingAddSequence,
}: MultiWindowSessionPickerProps) {
  const { t } = useTranslation();
  const [draftProjectId, setDraftProjectId] = useState(selectedProjectId || projects[0]?.id || '');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionPickerMode, setSessionPickerMode] = useState<SessionPickerMode>('select');
  const activeProject = useMemo(
    () => projects.find((project) => project.id === draftProjectId) ?? projects[0] ?? null,
    [draftProjectId, projects],
  );
  const activeProjectId = activeProject?.id ?? '';
  const activeProjectDetail = resolveProjectDetail(activeProject);
  const normalizedSessionSearchQuery = sessionSearchQuery.trim().toLowerCase();
  const filteredCodingSessions = useMemo(() => {
    const codingSessions = activeProject?.codingSessions ?? [];
    if (!normalizedSessionSearchQuery) {
      return codingSessions;
    }

    return codingSessions.filter((codingSession) =>
      buildSessionSearchText(codingSession).includes(normalizedSessionSearchQuery),
    );
  }, [activeProject, normalizedSessionSearchQuery]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex h-[min(720px,100%)] w-full max-w-[980px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#15161b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-100">{t('multiWindow.chooseSession')}</div>
            <div className="mt-0.5 text-xs text-gray-500">{t('multiWindow.chooseSessionDescription')}</div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
            title={t('multiWindow.close')}
          >
            <X size={16} />
          </button>
        </div>

        {addProgress ? (
          <div className="shrink-0 border-b border-blue-400/10 bg-blue-500/[0.07] px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-blue-100">
                {t('multiWindow.addProgress', {
                  current: addProgress.currentWindowNumber,
                  remaining: addProgress.remainingWindowCount,
                  target: addProgress.targetWindowCount,
                })}
              </div>
              {addProgress.remainingWindowCount > 0 && onStopPendingAddSequence ? (
                <button
                  type="button"
                  className="h-7 rounded-md border border-blue-300/20 bg-blue-300/10 px-2.5 text-[11px] font-medium text-blue-100 transition-colors hover:border-blue-200/30 hover:bg-blue-300/15"
                  title={t('multiWindow.stopAfterCurrentWindow')}
                  onClick={() => onStopPendingAddSequence()}
                >
                  {t('multiWindow.stopAfterCurrentWindow')}
                </button>
              ) : null}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-blue-950/80">
              <div
                className="h-full rounded-full bg-blue-300"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (addProgress.currentWindowNumber / addProgress.targetWindowCount) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[290px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-white/10 p-2 md:border-b-0 md:border-r md:border-white/10">
            {projects.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">{t('multiWindow.noProjects')}</div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
                  }`}
                  onClick={() => {
                    setDraftProjectId(project.id);
                    setSessionSearchQuery('');
                  }}
                >
                  <FolderOpen size={14} className="shrink-0 text-blue-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-gray-100">{project.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                      {resolveProjectDetail(project)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400">
                    {t('multiWindow.sessionCount', { count: project.codingSessions.length })}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{t('multiWindow.project')}</div>
                  <div className="mt-0.5 truncate text-sm font-medium text-gray-100">
                    {activeProject?.name ?? '-'}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-gray-500">{activeProjectDetail}</div>
                </div>
                <div className="flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.035] p-1">
                  <button
                    type="button"
                    className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                      sessionPickerMode === 'select'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-500 hover:bg-white/6 hover:text-gray-200'
                    }`}
                    onClick={() => setSessionPickerMode('select')}
                  >
                    {t('multiWindow.selectExistingSession')}
                  </button>
                  <button
                    type="button"
                    className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                      sessionPickerMode === 'create'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-white/6 hover:text-gray-200'
                    }`}
                    onClick={() => setSessionPickerMode('create')}
                  >
                    {t('multiWindow.createSessionAndAdd')}
                  </button>
                </div>
              </div>
            </div>

            {sessionPickerMode === 'create' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mx-auto w-full max-w-[620px] rounded-lg border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
                      <Plus size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-100">
                        {t('multiWindow.createSessionForProject')}
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-400">{activeProject?.name ?? '-'}</div>
                      <div className="mt-0.5 truncate text-[11px] text-gray-600">{activeProjectDetail}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-gray-400">
                    {t('multiWindow.createSessionAndAddDescription')}
                  </p>
                  <div className="mt-4 rounded-lg border border-white/10 bg-[#121318] p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-200">
                      <SlidersHorizontal size={14} className="text-blue-300" />
                      {t('multiWindow.newSessionConfiguration')}
                    </div>
                    <MultiWindowPaneConfigurationForm
                      pane={pane}
                      preferences={preferences}
                      onChange={onPaneChange}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/6 disabled:text-gray-500"
                    disabled={!activeProjectId || isCreatingSession}
                    onClick={() => onCreateSession(activeProjectId)}
                  >
                    <Plus size={15} />
                    {isCreatingSession ? t('multiWindow.creatingSession') : t('multiWindow.createSessionAndAdd')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 px-4 py-3">
                  <label className="relative block">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-blue-400/50 focus:bg-white/[0.06]"
                      value={sessionSearchQuery}
                      placeholder={t('multiWindow.sessionSearchPlaceholder')}
                      onChange={(event) => setSessionSearchQuery(event.target.value)}
                    />
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {(activeProject?.codingSessions.length ?? 0) === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="w-full max-w-[420px] rounded-lg border border-white/10 bg-white/[0.025] p-5 text-center">
                        <MessageSquareText size={22} className="mx-auto text-gray-500" />
                        <div className="mt-3 text-sm font-medium text-gray-200">{t('multiWindow.noSessions')}</div>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          {t('multiWindow.noSessionsCreateHint')}
                        </p>
                        <button
                          type="button"
                          className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/6 disabled:text-gray-500"
                          disabled={!activeProjectId || isCreatingSession}
                          title={t('multiWindow.createFirstSessionAndAdd')}
                          onClick={() => setSessionPickerMode('create')}
                        >
                          <Plus size={14} />
                          {isCreatingSession
                            ? t('multiWindow.creatingSession')
                            : t('multiWindow.createFirstSessionAndAdd')}
                        </button>
                      </div>
                    </div>
                  ) : filteredCodingSessions.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">
                      {t('multiWindow.sessionNoMatches')}
                    </div>
                  ) : (
                    filteredCodingSessions.map((codingSession) => {
                      const isSelectedSession =
                        selectedProjectId === activeProjectId &&
                        selectedCodingSessionId === codingSession.id;

                      return (
                        <button
                          key={codingSession.id}
                          type="button"
                          className={`mb-2 flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left text-xs transition-colors ${
                            isSelectedSession
                              ? 'border-blue-400/40 bg-blue-500/10 text-blue-100'
                              : 'border-white/10 bg-white/[0.025] text-gray-400 hover:border-white/20 hover:bg-white/[0.055] hover:text-gray-200'
                          }`}
                          onClick={() => onSelectSession(activeProjectId, codingSession.id)}
                        >
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-100">{codingSession.title}</span>
                            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                              {formatShortSessionId(codingSession.id)}
                            </span>
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-gray-300">
                              <Cpu size={12} className="shrink-0 text-blue-300" />
                              <span className="truncate">{codingSession.engineId}</span>
                              <span className="text-gray-600">/</span>
                              <span className="truncate">
                                {codingSession.modelId || t('multiWindow.sessionModelUnknown')}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] capitalize text-gray-300">
                              <Hash size={12} className="shrink-0 text-purple-300" />
                              {formatSessionToken(
                                codingSession.runtimeStatus || codingSession.status,
                                t('multiWindow.sessionStatusUnknown'),
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-gray-300">
                              <MessageSquareText size={12} className="shrink-0 text-emerald-300" />
                              {t('multiWindow.sessionMessageCount', { count: codingSession.messages.length })}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-gray-300">
                              <Clock3 size={12} className="shrink-0 text-amber-300" />
                              <span className="truncate">
                                {t('multiWindow.sessionUpdatedAt', {
                                  time: resolveSessionActivityLabel(codingSession),
                                })}
                              </span>
                            </span>
                          </span>
                        </span>
                          {isSelectedSession ? (
                            <Check size={16} className="mt-0.5 shrink-0 text-blue-300" />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MultiWindowSessionPicker.displayName = 'MultiWindowSessionPicker';
