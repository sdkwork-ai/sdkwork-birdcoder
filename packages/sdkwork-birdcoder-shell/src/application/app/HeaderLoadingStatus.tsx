import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { ProjectMountRecoveryEventPayload } from '@sdkwork/birdcoder-commons';

type HeaderLoadingStatusProps = {
  activeWorkspaceName?: string | null;
  workspaceId: string;
  isWorkspacesLoading: boolean;
  hasActiveProjectsFetched: boolean;
  projectMountRecoveryNotice: ProjectMountRecoveryEventPayload | null;
  projectMountRecoveryStartedAt: number | null;
};

type HeaderLoadingItem = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
};

function formatElapsedDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export const HeaderLoadingStatus = React.memo(function HeaderLoadingStatus({
  activeWorkspaceName,
  workspaceId,
  isWorkspacesLoading,
  hasActiveProjectsFetched,
  projectMountRecoveryNotice,
  projectMountRecoveryStartedAt,
}: HeaderLoadingStatusProps) {
  const [showPopover, setShowPopover] = useState(false);
  const isProjectMountRecovering =
    projectMountRecoveryNotice?.state.status === 'recovering';
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );
  const [projectMountRecoveryTick, setProjectMountRecoveryTick] = useState(() => Date.now());
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      !projectMountRecoveryStartedAt ||
      !isProjectMountRecovering ||
      !showPopover ||
      !isDocumentVisible
    ) {
      return;
    }

    setProjectMountRecoveryTick(Date.now());
  }, [
    isDocumentVisible,
    isProjectMountRecovering,
    projectMountRecoveryStartedAt,
    showPopover,
  ]);

  useEffect(() => {
    if (!isProjectMountRecovering || !showPopover || typeof document === 'undefined') {
      return;
    }

    const syncDocumentVisibility = () => {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    };

    syncDocumentVisibility();
    document.addEventListener('visibilitychange', syncDocumentVisibility);

    return () => {
      document.removeEventListener('visibilitychange', syncDocumentVisibility);
    };
  }, [isProjectMountRecovering, showPopover]);

  useEffect(() => {
    if (!isProjectMountRecovering || !showPopover || !isDocumentVisible) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setProjectMountRecoveryTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDocumentVisible, isProjectMountRecovering, showPopover]);

  const projectMountRecoveryElapsedLabel = useMemo(() => {
    if (!projectMountRecoveryStartedAt || !isProjectMountRecovering) {
      return null;
    }

    return formatElapsedDuration(projectMountRecoveryTick - projectMountRecoveryStartedAt);
  }, [
    isProjectMountRecovering,
    projectMountRecoveryStartedAt,
    projectMountRecoveryTick,
  ]);

  const headerLoadingItems = useMemo<HeaderLoadingItem[]>(() => {
    const items: HeaderLoadingItem[] = [];

    if (isWorkspacesLoading) {
      items.push({
        id: 'workspaces-loading',
        title: 'Loading workspaces',
        detail: 'Synchronizing available workspaces and restoring the startup scope.',
      });
    }

    if (workspaceId.length > 0 && !hasActiveProjectsFetched) {
      items.push({
        id: 'projects-loading',
        title: 'Loading projects',
        detail: 'Reading imported projects from the active workspace authority.',
        meta: activeWorkspaceName ?? workspaceId,
      });
    }

    if (isProjectMountRecovering) {
      items.push({
        id: 'project-mount-recovery',
        title: 'Reconnecting local project folder',
        detail:
          projectMountRecoveryNotice.state.path ??
          'Restoring the local folder mount for the active project.',
        meta: [
          projectMountRecoveryNotice.projectName ?? null,
          projectMountRecoveryNotice.surface === 'studio' ? 'Studio' : 'Code',
          projectMountRecoveryElapsedLabel,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' / '),
      });
    }

    return items;
  }, [
    activeWorkspaceName,
    hasActiveProjectsFetched,
    isWorkspacesLoading,
    isProjectMountRecovering,
    projectMountRecoveryElapsedLabel,
    projectMountRecoveryNotice,
    workspaceId,
  ]);

  useEffect(() => {
    if (headerLoadingItems.length > 0) {
      return;
    }

    setShowPopover(false);
  }, [headerLoadingItems.length]);

  useEffect(() => {
    if (!showPopover) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  if (headerLoadingItems.length === 0) {
    return null;
  }

  return (
    <div ref={popoverRef} className="relative shrink-0">
      <button
        type="button"
        data-no-drag="true"
        onClick={() => setShowPopover((currentValue) => !currentValue)}
        aria-haspopup="dialog"
        aria-expanded={showPopover}
        title={headerLoadingItems[0]?.title ?? 'Loading'}
        className="flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[11px] text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <LoaderCircle size={13} className="shrink-0 animate-spin text-sky-300" />
        <span className="hidden xl:inline">Loading</span>
        {headerLoadingItems.length > 1 ? (
          <span className="text-[10px] font-semibold text-gray-500">
            {headerLoadingItems.length}
          </span>
        ) : null}
      </button>

      {showPopover ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#18181b]/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-left">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <LoaderCircle size={14} className="animate-spin text-sky-300" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Background loading</div>
              <div className="text-[11px] text-gray-400">
                Loading details live in the header so the workspace stays visually clean.
              </div>
            </div>
          </div>
          <div className="flex flex-col p-2">
            {headerLoadingItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <div className="text-xs font-medium text-gray-100">{item.title}</div>
                {item.meta ? (
                  <div className="mt-0.5 text-[11px] text-sky-300">{item.meta}</div>
                ) : null}
                {item.detail ? (
                  <div className="mt-1 break-all text-[11px] leading-5 text-gray-400">
                    {item.detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});

HeaderLoadingStatus.displayName = 'HeaderLoadingStatus';
