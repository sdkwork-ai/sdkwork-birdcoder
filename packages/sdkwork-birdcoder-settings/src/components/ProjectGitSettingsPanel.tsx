import type { ReactNode } from 'react';
import {
  ProjectGitOverviewPanel,
  type ProjectGitOverviewSectionId,
} from '@sdkwork/birdcoder-ui';
import { useTranslation } from 'react-i18next';

interface ProjectGitSettingsPanelProps {
  currentProjectId?: string;
  currentProjectName?: string;
  supplementaryContent?: ReactNode;
  title: string;
  visibleSections: readonly ProjectGitOverviewSectionId[];
}

export function ProjectGitSettingsPanel({
  currentProjectId,
  currentProjectName,
  supplementaryContent,
  title,
  visibleSections,
}: ProjectGitSettingsPanelProps) {
  const { t } = useTranslation();
  const normalizedProjectId = currentProjectId?.trim() ?? '';
  const currentProjectLabel = currentProjectName?.trim() || normalizedProjectId || t('code.selectProjectFirst');

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <div className="mt-2 truncate text-sm text-gray-500">
              {currentProjectLabel}
            </div>
          </div>
          {normalizedProjectId ? (
            <div className="max-w-full rounded-full border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs text-gray-300">
              <span className="truncate">{currentProjectLabel}</span>
            </div>
          ) : null}
        </div>

        {supplementaryContent ? (
          <div className="mb-6">
            {supplementaryContent}
          </div>
        ) : null}

        <ProjectGitOverviewPanel
          bodyMaxHeight={560}
          projectId={currentProjectId}
          visibleSections={visibleSections}
        />
      </div>
    </div>
  );
}
