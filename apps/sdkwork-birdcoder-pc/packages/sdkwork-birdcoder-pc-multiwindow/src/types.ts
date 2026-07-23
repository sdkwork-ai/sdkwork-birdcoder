import type {
  AgentSessionItemView,
  AgentSessionView,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export type MultiWindowGlobalMode = 'chat' | 'preview';
export type MultiWindowPaneMode = MultiWindowGlobalMode;
export type MultiWindowPaneRuntimeStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'not-submitted';
export type MultiWindowDispatchState =
  | 'idle'
  | 'running'
  | 'success'
  | 'partial-failure'
  | 'failed'
  | 'skipped'
  | 'stopped';

export interface MultiWindowModelParameters {
  maxOutputTokens: number;
  systemPrompt: string;
  temperature: number;
  topP: number;
}

export interface MultiWindowPaneConfig {
  agentSessionId: string;
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
  agentSession: AgentSessionView | null;
  messages: AgentSessionItemView[];
  project: BirdCoderProject | null;
}

export interface MultiWindowProgrammingPageProps {
  initialAgentSessionId?: string;
  isVisible?: boolean;
  projectId?: string;
  workspaceId: string;
  onAgentSessionChange?: (agentSessionId: string, projectId?: string) => void;
  onProjectChange?: (projectId: string) => void;
}
