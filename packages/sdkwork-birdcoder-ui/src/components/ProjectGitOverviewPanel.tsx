import { memo } from 'react';
import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-commons';
import { useProjectGitOverview } from '@sdkwork/birdcoder-commons';
import {
  ProjectGitOverviewSurface,
  type ProjectGitOverviewSectionId,
} from './ProjectGitOverviewSurface';

interface ProjectGitOverviewPanelProps {
  bodyMaxHeight?: number | null;
  projectId?: string;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  showHeader?: boolean;
  visibleSections?: readonly ProjectGitOverviewSectionId[];
}

export const ProjectGitOverviewPanel = memo(function ProjectGitOverviewPanel({
  bodyMaxHeight,
  projectId,
  projectGitOverviewState,
  showHeader,
  visibleSections,
}: ProjectGitOverviewPanelProps) {
  const localProjectGitOverviewState = useProjectGitOverview({
    isActive: !projectGitOverviewState,
    projectId,
  });
  const {
    currentWorktree,
    isLoading,
    loadErrorMessage,
    normalizedProjectId,
    overview,
    refreshGitOverview,
  } = projectGitOverviewState ?? localProjectGitOverviewState;

  return (
    <ProjectGitOverviewSurface
      bodyMaxHeight={bodyMaxHeight}
      currentWorktree={currentWorktree}
      isLoading={isLoading}
      loadErrorMessage={loadErrorMessage}
      normalizedProjectId={normalizedProjectId}
      onRefresh={() => {
        void refreshGitOverview();
      }}
      overview={overview}
      showHeader={showHeader}
      visibleSections={visibleSections}
    />
  );
});
