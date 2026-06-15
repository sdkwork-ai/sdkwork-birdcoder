import { useState } from 'react';
import { FlaskConical, Globe, MonitorPlay, RefreshCw, Wrench } from 'lucide-react';

import {
  filterUnifiedStudioEvidenceEntries,
  summarizeUnifiedStudioEvidenceEntries,
  type UnifiedStudioEvidenceEntry,
} from './viewer.ts';

interface StudioEvidencePanelProps {
  entries: UnifiedStudioEvidenceEntry[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onCopyCompareTemplate?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyCompareIssueTemplate?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyCompareReleaseNote?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyCompareDiagnostics?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyCompareSummary?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopySummary?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyIssueTemplate?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyReleaseNote?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyVisibleDiagnostics?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
  onCopyDiagnostics?: (entry: UnifiedStudioEvidenceEntry) => void;
  onReplay?: (entry: UnifiedStudioEvidenceEntry) => void;
  onExport?: (
    entries: UnifiedStudioEvidenceEntry[],
    laneFilter: 'all' | 'preview' | 'build' | 'simulator' | 'test',
  ) => void;
}

function formatLaunchedAt(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Unknown time';
  }

  return new Date(timestamp).toLocaleString();
}

function resolveLanePresentation(lane: UnifiedStudioEvidenceEntry['lane']) {
  switch (lane) {
    case 'preview':
      return {
        label: 'Preview',
        icon: Globe,
        className: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
      };
    case 'build':
      return {
        label: 'Build',
        icon: Wrench,
        className: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
      };
    case 'test':
      return {
        label: 'Test',
        icon: FlaskConical,
        className: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
      };
    default:
      return {
        label: 'Simulator',
        icon: MonitorPlay,
        className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
      };
  }
}

export function StudioEvidencePanel({
  entries,
  isLoading = false,
  onRefresh,
  onCopyCompareTemplate,
  onCopyCompareIssueTemplate,
  onCopyCompareReleaseNote,
  onCopyCompareDiagnostics,
  onCopyCompareSummary,
  onCopySummary,
  onCopyIssueTemplate,
  onCopyReleaseNote,
  onCopyVisibleDiagnostics,
  onCopyDiagnostics,
  onReplay,
  onExport,
}: StudioEvidencePanelProps) {
  const [selectedLane, setSelectedLane] = useState<'all' | 'preview' | 'build' | 'simulator' | 'test'>('all');
  const [selectedEvidenceKeys, setSelectedEvidenceKeys] = useState<string[]>([]);
  const visibleEntries = filterUnifiedStudioEvidenceEntries(entries, selectedLane);
  const visibleSummary = summarizeUnifiedStudioEvidenceEntries(visibleEntries);
  const selectedEntries = visibleEntries.filter((entry) => selectedEvidenceKeys.includes(entry.evidenceKey));

  const toggleSelectedEvidenceEntry = (entry: UnifiedStudioEvidenceEntry) => {
    setSelectedEvidenceKeys((previousState) => (
      previousState.includes(entry.evidenceKey)
        ? previousState.filter((evidenceKey) => evidenceKey !== entry.evidenceKey)
        : [...previousState, entry.evidenceKey].slice(-2)
    ));
  };

  return (
    <aside className="w-[320px] shrink-0 border-l border-white/10 bg-[#111114] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-sm font-medium text-gray-200">Studio Evidence</div>
          <div className="text-xs text-gray-500">Preview, Build, Simulator, Test</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyCompareTemplate?.(selectedEntries, selectedLane)}
            disabled={selectedEntries.length !== 2}
          >
            Copy Compare Template
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyCompareIssueTemplate?.(selectedEntries, selectedLane)}
            disabled={selectedEntries.length !== 2}
          >
            Copy Compare Issue Template
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyCompareReleaseNote?.(selectedEntries, selectedLane)}
            disabled={selectedEntries.length !== 2}
          >
            Copy Compare Release Note
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyCompareDiagnostics?.(selectedEntries, selectedLane)}
            disabled={selectedEntries.length !== 2}
          >
            Copy Compare Diagnostics
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyCompareSummary?.(selectedEntries, selectedLane)}
            disabled={selectedEntries.length !== 2}
          >
            Copy Compare Summary
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopySummary?.(visibleEntries, selectedLane)}
            disabled={visibleEntries.length === 0}
          >
            Copy Summary
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyIssueTemplate?.(visibleEntries, selectedLane)}
            disabled={visibleEntries.length === 0}
          >
            Copy Issue Template
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyReleaseNote?.(visibleEntries, selectedLane)}
            disabled={visibleEntries.length === 0}
          >
            Copy Release Note
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onCopyVisibleDiagnostics?.(visibleEntries, selectedLane)}
            disabled={visibleEntries.length === 0}
          >
            Copy Visible Diagnostics
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onExport?.(visibleEntries, selectedLane)}
            disabled={visibleEntries.length === 0}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="p-2 rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
            onClick={onRefresh}
            title="Refresh evidence"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-white/10 flex flex-wrap gap-2">
        {['all', 'preview', 'build', 'simulator', 'test'].map((lane) => (
          <button
            key={lane}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selectedLane === lane
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-white/10 bg-black/20 text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
            onClick={() => setSelectedLane(lane as 'all' | 'preview' | 'build' | 'simulator' | 'test')}
          >
            {lane}
          </button>
        ))}
      </div>

      {!isLoading && visibleEntries.length > 0 ? (
        <div className="mx-3 mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            Visible Slice
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-500">Entries</div>
              <div className="text-gray-200">{visibleSummary.entryCount}</div>
            </div>
            <div>
              <div className="text-gray-500">Lanes</div>
              <div className="text-gray-200">{visibleSummary.lanes.join(', ')}</div>
            </div>
            <div>
              <div className="text-gray-500">Projects</div>
              <div className="text-gray-200">{visibleSummary.projectIds.join(', ')}</div>
            </div>
            <div>
              <div className="text-gray-500">Profiles</div>
              <div className="text-gray-200">{visibleSummary.profileIds.join(', ')}</div>
            </div>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Latest launch</span>
            <span className="ml-2 text-gray-200">{formatLaunchedAt(visibleSummary.latestLaunchedAt ?? 0)}</span>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-gray-400">
            Loading evidence history...
          </div>
        ) : null}

        {!isLoading && visibleEntries.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-gray-400">
            No Studio evidence recorded for this lane yet.
          </div>
        ) : null}

        {!isLoading
          ? visibleEntries.map((entry) => {
            const lanePresentation = resolveLanePresentation(entry.lane);
            const LaneIcon = lanePresentation.icon;

            return (
              <section
                key={entry.evidenceKey}
                className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-100 truncate">{entry.title}</div>
                    <div className="text-xs text-gray-500 truncate">{entry.summary}</div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${lanePresentation.className}`}
                  >
                    <LaneIcon size={12} />
                    {lanePresentation.label}
                  </span>
                </div>

                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-gray-500">Evidence Key</dt>
                    <dd className="text-gray-300 break-all">{entry.evidenceKey}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Command</dt>
                    <dd className="text-gray-300 break-all">{entry.command}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Working Directory</dt>
                    <dd className="text-gray-300 break-all">{entry.cwd}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <dt className="text-gray-500">Project</dt>
                      <dd className="text-gray-300 truncate">{entry.projectId}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-gray-500">Run Config</dt>
                      <dd className="text-gray-300">{entry.runConfigurationId}</dd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <dt className="text-gray-500">Profile</dt>
                      <dd className="text-gray-300 truncate">{entry.profileId}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-gray-500">Launched</dt>
                      <dd className="text-gray-300">{formatLaunchedAt(entry.launchedAt)}</dd>
                    </div>
                  </div>
                </dl>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selectedEvidenceKeys.includes(entry.evidenceKey)
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => toggleSelectedEvidenceEntry(entry)}
                  >
                    {selectedEvidenceKeys.includes(entry.evidenceKey) ? 'Selected' : 'Select'}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    onClick={() => onCopyDiagnostics?.(entry)}
                  >
                    Copy Diagnostics
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    onClick={() => onReplay?.(entry)}
                  >
                    Replay
                  </button>
                </div>
              </section>
            );
          })
          : null}
      </div>
    </aside>
  );
}
