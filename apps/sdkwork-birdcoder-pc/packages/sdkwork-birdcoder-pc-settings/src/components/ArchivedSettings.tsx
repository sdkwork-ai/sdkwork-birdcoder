import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useArchivedAgentSessions,
  useToast,
  useWorkspaces,
} from '@sdkwork/birdcoder-pc-workbench';
import { ConfirmationDialog } from '@sdkwork/birdcoder-pc-ui-shell';

import { ArchivedProjectGroup } from './archived/ArchivedProjectGroup';
import { ArchivedSettingsState } from './archived/ArchivedSettingsState';
import { ArchivedSettingsToolbar } from './archived/ArchivedSettingsToolbar';
import type {
  ArchivedProjectGroupView,
  ArchivedProjectOption,
  ArchivedTaskSort,
  ArchivedTaskTypeFilter,
} from './archived/archivedSettingsTypes';

interface ArchivedSettingsProps {
  workspaceId: string;
}

type DeleteConfirmation =
  | { kind: 'all'; groups: ArchivedProjectGroupView[] }
  | { kind: 'project'; group: ArchivedProjectGroupView }
  | { kind: 'session'; projectId: string; sessionId: string; title: string };

function compareArchivedSessions(
  left: ArchivedProjectGroupView['sessions'][number],
  right: ArchivedProjectGroupView['sessions'][number],
  locale: string,
  sort: ArchivedTaskSort,
): number {
  if (sort === 'name') {
    return left.title.localeCompare(right.title, locale, { sensitivity: 'base' });
  }
  const field = sort === 'created' ? 'createdAt' : 'updatedAt';
  return Date.parse(right[field]) - Date.parse(left[field]);
}

export function ArchivedSettings({ workspaceId }: ArchivedSettingsProps) {
  const { i18n, t } = useTranslation();
  const { addToast } = useToast();
  const {
    hasMore: hasMoreWorkspaces,
    isLoadingMore: isLoadingMoreWorkspaces,
    loadMoreWorkspaces,
    workspaces,
  } = useWorkspaces({ isActive: true, preferredWorkspaceId: workspaceId });
  const workspaceOptions = useMemo(() => {
    const options = new Map(workspaces.map((workspace) => [
      workspace.workspaceId,
      { id: workspace.workspaceId, name: workspace.name },
    ]));
    if (workspaceId && !options.has(workspaceId)) {
      options.set(workspaceId, { id: workspaceId, name: workspaceId });
    }
    return Array.from(options.values());
  }, [workspaceId, workspaces]);
  const inventoryWorkspaceIds = useMemo(
    () => workspaceOptions.map((workspace) => workspace.id),
    [workspaceOptions],
  );
  const {
    availableProjects,
    deleteSession,
    error,
    isLoading,
    projects,
    refresh,
    restoreSession: restoreArchivedSession,
  } = useArchivedAgentSessions({
    isActive: inventoryWorkspaceIds.length > 0,
    workspaceIds: inventoryWorkspaceIds,
  });
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [workspaceFilter, setWorkspaceFilter] = useState(workspaceId || 'all');
  const [taskType, setTaskType] = useState<ArchivedTaskTypeFilter>('all');
  const [sort, setSort] = useState<ArchivedTaskSort>('updated');
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);

  useEffect(() => {
    if (hasMoreWorkspaces && !isLoadingMoreWorkspaces) {
      void loadMoreWorkspaces();
    }
  }, [hasMoreWorkspaces, isLoadingMoreWorkspaces, loadMoreWorkspaces]);

  useEffect(() => {
    setWorkspaceFilter((current) => current === 'all' ? current : workspaceId || 'all');
    setProjectFilter('all');
  }, [workspaceId]);

  const resolvedWorkspaceFilter = workspaceFilter === 'all'
    || workspaceOptions.some((workspace) => workspace.id === workspaceFilter)
    ? workspaceFilter
    : workspaceId || 'all';

  useEffect(() => {
    if (resolvedWorkspaceFilter !== workspaceFilter) {
      setWorkspaceFilter(resolvedWorkspaceFilter);
      setProjectFilter('all');
    }
  }, [resolvedWorkspaceFilter, workspaceFilter]);

  const allGroups = useMemo<ArchivedProjectGroupView[]>(() => projects.flatMap((project) => {
    const sessions = project.agentSessions
      .filter((session) => session.archived)
      .map((session) => ({
        createdAt: session.createdAt,
        id: session.id,
        projectId: project.projectId,
        status: session.status,
        taskType: session.hostMode === 'desktop' ? 'local' as const : 'cloud' as const,
        title: session.title,
        updatedAt: session.updatedAt,
      }));
    return sessions.length > 0
      ? [{
          projectId: project.projectId,
          projectName: project.name,
          sessions,
          workspaceId: project.workspaceId,
        }]
      : [];
  }), [projects]);

  const workspaceGroups = useMemo(() => allGroups.filter((group) => (
    resolvedWorkspaceFilter === 'all' || group.workspaceId === resolvedWorkspaceFilter
  )), [allGroups, resolvedWorkspaceFilter]);
  const projectOptions = useMemo<ArchivedProjectOption[]>(() => {
    const options = new Map<string, ArchivedProjectOption>();
    availableProjects.forEach((project) => {
      if (
        resolvedWorkspaceFilter === 'all'
        || project.workspaceId === resolvedWorkspaceFilter
      ) {
        options.set(project.projectId, { id: project.projectId, name: project.name });
      }
    });
    return Array.from(options.values()).sort((left, right) => (
      left.name.localeCompare(right.name, i18n.language, { sensitivity: 'base' })
    ));
  }, [availableProjects, i18n.language, resolvedWorkspaceFilter]);
  const resolvedProjectFilter = projectFilter === 'all'
    || projectOptions.some((project) => project.id === projectFilter)
    ? projectFilter
    : 'all';

  useEffect(() => {
    if (resolvedProjectFilter !== projectFilter) {
      setProjectFilter(resolvedProjectFilter);
    }
  }, [projectFilter, resolvedProjectFilter]);

  const normalizedQuery = query.trim().toLocaleLowerCase(i18n.language);
  const filteredGroups = useMemo<ArchivedProjectGroupView[]>(() => workspaceGroups
    .flatMap((group) => {
      if (resolvedProjectFilter !== 'all' && group.projectId !== resolvedProjectFilter) {
        return [];
      }
      const sessions = group.sessions
        .filter((session) => (
          (taskType === 'all' || session.taskType === taskType)
          && (!normalizedQuery
            || session.title.toLocaleLowerCase(i18n.language).includes(normalizedQuery))
        ))
        .sort((left, right) => compareArchivedSessions(left, right, i18n.language, sort));
      return sessions.length > 0 ? [{ ...group, sessions }] : [];
    })
    .sort((left, right) => {
      if (sort === 'name') {
        return left.projectName.localeCompare(right.projectName, i18n.language, {
          sensitivity: 'base',
        });
      }
      return compareArchivedSessions(left.sessions[0]!, right.sessions[0]!, i18n.language, sort);
    }), [
      i18n.language,
      normalizedQuery,
      resolvedProjectFilter,
      sort,
      taskType,
      workspaceGroups,
    ]);

  const archivedSessionCount = workspaceGroups.reduce(
    (count, group) => count + group.sessions.length,
    0,
  );
  const visibleSessionCount = filteredGroups.reduce(
    (count, group) => count + group.sessions.length,
    0,
  );

  const markPending = (sessionIds: string[], pending: boolean) => {
    setPendingSessionIds((current) => {
      const next = new Set(current);
      sessionIds.forEach((sessionId) => pending ? next.add(sessionId) : next.delete(sessionId));
      return next;
    });
  };

  const restoreSessions = async (group: ArchivedProjectGroupView) => {
    const sessionIds = group.sessions.map((session) => session.id);
    markPending(sessionIds, true);
    const results = await Promise.all(group.sessions.map((session) => (
      restoreArchivedSession(group.projectId, session.id)
    )));
    markPending(sessionIds, false);
    const restoredCount = results.filter(Boolean).length;
    if (restoredCount > 0) {
      addToast(t('settings.archived.restoredCount', { count: restoredCount }), 'success');
    }
    if (restoredCount !== results.length) {
      addToast(t('settings.archived.restoreFailed'), 'error');
    }
  };

  const restoreSession = async (projectId: string, sessionId: string) => {
    markPending([sessionId], true);
    const restored = await restoreArchivedSession(projectId, sessionId);
    markPending([sessionId], false);
    addToast(
      t(restored ? 'settings.archived.restored' : 'settings.archived.restoreFailed'),
      restored ? 'success' : 'error',
    );
  };

  const confirmDelete = async () => {
    const confirmation = deleteConfirmation;
    if (!confirmation) {
      return;
    }
    const targets = confirmation.kind === 'session'
      ? [{ projectId: confirmation.projectId, sessionId: confirmation.sessionId }]
      : (confirmation.kind === 'all' ? confirmation.groups : [confirmation.group])
        .flatMap((group) => group.sessions.map((session) => ({
          projectId: group.projectId,
          sessionId: session.id,
        })));
    markPending(targets.map((target) => target.sessionId), true);
    const results = await Promise.all(targets.map((target) => (
      deleteSession(target.projectId, target.sessionId)
    )));
    markPending(targets.map((target) => target.sessionId), false);
    setDeleteConfirmation(null);
    const deletedCount = results.filter(Boolean).length;
    if (deletedCount > 0) {
      addToast(t('settings.archived.deletedCount', { count: deletedCount }), 'success');
    }
    if (deletedCount !== results.length) {
      addToast(t('settings.archived.deleteFailed'), 'error');
    }
  };

  const deleteTargetCount = deleteConfirmation?.kind === 'all'
    ? deleteConfirmation.groups.reduce((count, group) => count + group.sessions.length, 0)
    : deleteConfirmation?.kind === 'project'
      ? deleteConfirmation.group.sessions.length
      : deleteConfirmation ? 1 : 0;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#0e0e11] px-5 py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[1040px] animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
        <div className="flex min-h-9 items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-white">{t('settings.archived.title')}</h1>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-red-500/10 px-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:pointer-events-none disabled:opacity-40"
            disabled={archivedSessionCount === 0 || pendingSessionIds.size > 0}
            onClick={() => setDeleteConfirmation({ kind: 'all', groups: workspaceGroups })}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
            {t('settings.archived.deleteAll')}
          </button>
        </div>

        <ArchivedSettingsToolbar
          onProjectFilterChange={setProjectFilter}
          onQueryChange={setQuery}
          onSortChange={setSort}
          onTaskTypeChange={setTaskType}
          onWorkspaceFilterChange={(nextWorkspaceId) => {
            setWorkspaceFilter(nextWorkspaceId);
            setProjectFilter('all');
          }}
          projectFilter={resolvedProjectFilter}
          projects={projectOptions}
          query={query}
          sort={sort}
          taskType={taskType}
          workspaceFilter={resolvedWorkspaceFilter}
          workspaces={workspaceOptions}
        />

        {isLoading ? (
          <ArchivedSettingsState kind="loading" />
        ) : error ? (
          <ArchivedSettingsState kind="error" onRetry={() => void refresh()} />
        ) : archivedSessionCount === 0 ? (
          <ArchivedSettingsState kind="empty" />
        ) : visibleSessionCount === 0 ? (
          <ArchivedSettingsState kind="filtered-empty" />
        ) : (
          <div className="mt-7 space-y-6" data-testid="archived-project-groups">
            {filteredGroups.map((group) => (
              <ArchivedProjectGroup
                group={group}
                key={`${group.workspaceId}:${group.projectId}`}
                locale={i18n.language}
                onDeleteProjectSessions={() => setDeleteConfirmation({ kind: 'project', group })}
                onDeleteSession={(session) => setDeleteConfirmation({
                  kind: 'session',
                  projectId: group.projectId,
                  sessionId: session.id,
                  title: session.title,
                })}
                onRestoreAll={() => void restoreSessions(group)}
                onRestoreSession={(sessionId) => void restoreSession(group.projectId, sessionId)}
                pendingSessionIds={pendingSessionIds}
              />
            ))}
          </div>
        )}
      </div>

      {deleteConfirmation ? (
        <ConfirmationDialog
          cancelLabel={t('common.cancel')}
          closeLabel={t('settings.archived.closeDeleteDialog')}
          confirmLabel={t('settings.archived.confirmPermanentDelete')}
          description={t('settings.archived.deleteConfirmDescription', {
            count: deleteTargetCount,
          })}
          onCancel={() => setDeleteConfirmation(null)}
          onConfirm={confirmDelete}
          title={deleteConfirmation.kind === 'session'
            ? t('settings.archived.deleteSessionConfirmTitle', {
                title: deleteConfirmation.title,
              })
            : t('settings.archived.deleteAllConfirmTitle', { count: deleteTargetCount })}
        />
      ) : null}
    </main>
  );
}
