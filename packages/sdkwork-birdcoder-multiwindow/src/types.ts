import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export type MultiWindowGlobalMode = 'chat' | 'preview';
export type MultiWindowPaneMode = MultiWindowGlobalMode;
export type MultiWindowPaneRuntimeStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled';
export type MultiWindowDispatchState =
  | 'idle'
  | 'running'
  | 'success'
  | 'partial-failure'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface MultiWindowModelParameters {
  maxOutputTokens: number;
  systemPrompt: string;
  temperature: number;
  topP: number;
}

export interface MultiWindowPaneConfig {
  codingSessionId: string;
  enabled: boolean;
  id: string;
  mode: MultiWindowPaneMode;
  parameters: MultiWindowModelParameters;
  previewUrl: string;
  projectId: string;
  selectedEngineId: string;
  selectedModelId: string;
  title: string;
}

export interface MultiWindowPaneBinding {
  codingSession: BirdCoderCodingSession | null;
  messages: BirdCoderChatMessage[];
  project: BirdCoderProject | null;
}

export interface MultiWindowProgrammingPageProps {
  initialCodingSessionId?: string;
  isVisible?: boolean;
  projectId?: string;
  workspaceId: string;
  onCodingSessionChange?: (codingSessionId: string, projectId?: string) => void;
  onProjectChange?: (projectId: string) => void;
}
