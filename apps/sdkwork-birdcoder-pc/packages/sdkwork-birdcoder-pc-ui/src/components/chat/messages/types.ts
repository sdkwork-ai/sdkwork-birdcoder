import type { ComponentType, ReactNode } from 'react';
import type {
  AgentSessionItemView,
  AgentSessionItemPresentation,
  AgentSessionItemViewKind,
  AgentSessionItemViewSource,
  FileChange,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatTranscriptTurnPresentation } from './presentation/transcriptTurnPresentation.ts';
import type { ChatProviderPresentationProfile } from './presentation/providerPresentationProfiles.ts';
import type {
  ChatTurnProcessPresentation,
} from './presentation/turnProcessPresentation.ts';

export interface ChatSkill {
  id: string;
  name: string;
  desc: string;
  icon?: string;
}

export type ChatMessageLayout = 'sidebar' | 'main';

export type ChatMessageTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export interface ChatMessageActionTarget {
  endIndex: number;
  startIndex: number;
}

export interface ChatMessageEnvironment {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  beginEditingMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageIds: string[]) => void;
  onOpenDriveAttachment?: (nodeId: string, title: string) => void;
  resolveDriveAttachmentPreviewUrl?: (nodeId: string) => Promise<string | undefined>;
  onOpenFile?: (path: string) => void;
  onOpenUrl?: (url: string) => void;
  onRegenerateMessage?: () => void;
  onRestore?: (messageId: string, fileChanges?: readonly FileChange[]) => void;
  onViewChanges?: (file: FileChange) => void;
  skills: readonly ChatSkill[];
  t: ChatMessageTranslate;
}

export interface ChatTurnFileChangesPresentation {
  fileChanges: readonly FileChange[];
  messageId: string;
  scopeKey: string;
}

export interface ChatMessageRenderContext {
  layout: ChatMessageLayout;
  index: number;
  sessionId: string;
  engineId?: string;
  environment: ChatMessageEnvironment | null;
  allMessages: readonly AgentSessionItemView[];
  actionTarget: ChatMessageActionTarget | null;
  showMessageActions: boolean;
  copyMessageToClipboard: (content: string) => void;
  expandedDisclosureKeys: ReadonlySet<string>;
  toggleDisclosure: (key: string) => void;
  renderMarkdownContent: (content: string, mode?: 'basic' | 'rich') => ReactNode;
  providerProfile?: ChatProviderPresentationProfile;
  suppressInlineFileChanges?: boolean;
  turn: ChatTranscriptTurnPresentation;
  turnFileChanges?: ChatTurnFileChangesPresentation;
  turnProcess?: ChatTurnProcessPresentation;
  suppressProcessBlocks?: boolean;
}

export interface ChatMessageRendererProps {
  view: AgentSessionItemPresentation;
  context: ChatMessageRenderContext;
  messageRef?: (element: HTMLDivElement | null) => void;
}

export type ChatMessageRendererComponent = ComponentType<ChatMessageRendererProps>;

export interface ChatMessageRendererMatch {
  viewKind?: AgentSessionItemViewKind | readonly AgentSessionItemViewKind[];
  engineId?: string;
  role?: AgentSessionItemView['role'] | readonly AgentSessionItemView['role'][];
}

export interface ChatMessageRendererEntry {
  id: string;
  match: ChatMessageRendererMatch;
  priority: number;
  Component: ChatMessageRendererComponent;
  estimateHeight: (
    view: AgentSessionItemPresentation,
    layout?: 'sidebar' | 'main',
  ) => number;
}
