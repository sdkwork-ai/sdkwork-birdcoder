import type { ComponentType, ReactNode } from 'react';
import type {
  BirdCoderChatMessage,
  BirdCoderChatMessageView,
  BirdCoderChatMessageViewKind,
  BirdCoderCodeEngineKey,
  ChatMessageViewSource,
  FileChange,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

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
  onOpenFile?: (path: string) => void;
  onRegenerateMessage?: () => void;
  onRestore?: (messageId: string) => void;
  onViewChanges?: (file: FileChange) => void;
  skills: readonly ChatSkill[];
  t: ChatMessageTranslate;
}

export interface ChatMessageRenderContext {
  layout: ChatMessageLayout;
  index: number;
  sessionId: string;
  engineId?: BirdCoderCodeEngineKey;
  environment: ChatMessageEnvironment | null;
  allMessages: readonly BirdCoderChatMessage[];
  actionTarget: ChatMessageActionTarget | null;
  showMessageActions: boolean;
  copyMessageToClipboard: (content: string) => void;
  expandedDisclosureKeys: ReadonlySet<string>;
  toggleDisclosure: (key: string) => void;
  renderMarkdownContent: (content: string, mode?: 'basic' | 'rich') => ReactNode;
}

export interface ChatMessageRendererProps {
  view: BirdCoderChatMessageView;
  context: ChatMessageRenderContext;
  messageRef?: (element: HTMLDivElement | null) => void;
}

export type ChatMessageRendererComponent = ComponentType<ChatMessageRendererProps>;

export interface ChatMessageRendererMatch {
  viewKind?: BirdCoderChatMessageViewKind | readonly BirdCoderChatMessageViewKind[];
  engineId?: BirdCoderCodeEngineKey;
  role?: BirdCoderChatMessage['role'] | readonly BirdCoderChatMessage['role'][];
}

export interface ChatMessageRendererEntry {
  id: string;
  match: ChatMessageRendererMatch;
  priority: number;
  Component: ChatMessageRendererComponent;
  estimateHeight: (
    view: BirdCoderChatMessageView,
    layout?: 'sidebar' | 'main',
  ) => number;
}
