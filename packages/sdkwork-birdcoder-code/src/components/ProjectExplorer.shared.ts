import type { CSSProperties } from 'react';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-types';

export interface ProjectExplorerProjectEntry {
  canShowMoreSessions: boolean;
  canToggleSessionExpansion: boolean;
  filteredSessions: BirdCoderCodingSession[];
  nextExpansionCount: number;
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
