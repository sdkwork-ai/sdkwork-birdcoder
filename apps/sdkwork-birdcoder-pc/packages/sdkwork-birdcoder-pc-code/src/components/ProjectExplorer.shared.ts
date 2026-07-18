import type { CSSProperties } from 'react';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface ProjectExplorerProjectEntry {
  canShowMoreSessions: boolean;
  filteredSessions: BirdCoderCodingSession[];
  isLoadingMoreSessions: boolean;
  nextVisibleSessionCount: number;
  project: BirdCoderProject;
  visibleSessions: BirdCoderCodingSession[];
}

export type ProjectExplorerOrganizeBy = 'project' | 'chronological';

export type ProjectExplorerSortBy = 'created' | 'updated';

export interface ProjectExplorerEngineOption {
  id: string;
  label: string;
  modelId?: string | null;
  terminalProfileId?: string | null;
}

export interface ProjectExplorerMenuPosition {
  x: number;
  y: number;
}

export function buildProjectExplorerSurfaceStyle(containIntrinsicSize: string): CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}
