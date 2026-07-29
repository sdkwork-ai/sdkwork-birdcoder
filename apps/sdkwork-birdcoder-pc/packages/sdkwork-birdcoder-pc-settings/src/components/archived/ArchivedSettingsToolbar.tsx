import { Boxes, Folder, Search } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ArchivedSelectMenu } from './ArchivedSelectMenu';
import { ArchivedTaskFilterMenu } from './ArchivedTaskFilterMenu';
import type {
  ArchivedProjectOption,
  ArchivedTaskSort,
  ArchivedTaskTypeFilter,
  ArchivedWorkspaceOption,
} from './archivedSettingsTypes';

interface ArchivedSettingsToolbarProps {
  onProjectFilterChange: (projectId: string) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: ArchivedTaskSort) => void;
  onTaskTypeChange: (type: ArchivedTaskTypeFilter) => void;
  onWorkspaceFilterChange: (workspaceId: string) => void;
  projectFilter: string;
  projects: readonly ArchivedProjectOption[];
  query: string;
  sort: ArchivedTaskSort;
  taskType: ArchivedTaskTypeFilter;
  workspaceFilter: string;
  workspaces: readonly ArchivedWorkspaceOption[];
}

export function ArchivedSettingsToolbar({
  onProjectFilterChange,
  onQueryChange,
  onSortChange,
  onTaskTypeChange,
  onWorkspaceFilterChange,
  projectFilter,
  projects,
  query,
  sort,
  taskType,
  workspaceFilter,
  workspaces,
}: ArchivedSettingsToolbarProps) {
  const { t } = useTranslation();
  const workspaceOptions = useMemo(() => [
    { label: t('settings.archived.allWorkspaces'), value: 'all' },
    ...workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id })),
  ], [t, workspaces]);
  const projectOptions = useMemo(() => [
    { label: t('settings.archived.allProjects'), value: 'all' },
    ...projects.map((project) => ({ label: project.name, value: project.id })),
  ], [projects, t]);

  return (
    <div
      className="@container mt-9"
      role="search"
    >
      <div className="grid grid-cols-1 gap-3 @min-[640px]:grid-cols-3 @min-[820px]:grid-cols-[minmax(250px,1fr)_150px_minmax(196px,220px)_minmax(184px,210px)]">
        <label className="relative min-w-0 @min-[640px]:col-span-3 @min-[820px]:col-span-1">
          <span className="sr-only">{t('settings.archived.searchPlaceholder')}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8b8f]"
            size={17}
          />
          <input
            aria-label={t('settings.archived.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#202022] pl-10 pr-3 text-sm text-white outline-none placeholder:text-[#88898d] hover:border-white/[0.14] focus:border-white/20 focus:ring-1 focus:ring-white/10"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('settings.archived.searchPlaceholder')}
            type="search"
            value={query}
          />
        </label>

        <ArchivedTaskFilterMenu
          onSortChange={onSortChange}
          onTypeChange={onTaskTypeChange}
          sort={sort}
          type={taskType}
        />
        <ArchivedSelectMenu
          icon={Boxes}
          label={t('settings.archived.workspaceFilterLabel')}
          onChange={onWorkspaceFilterChange}
          options={workspaceOptions}
          value={workspaceFilter}
        />
        <ArchivedSelectMenu
          disabled={projects.length === 0}
          icon={Folder}
          label={t('settings.archived.projectFilterLabel')}
          onChange={onProjectFilterChange}
          options={projectOptions}
          value={projectFilter}
        />
      </div>
    </div>
  );
}
