import type { ChangeEvent, RefObject } from 'react';
import type { ModelsPickerGroup } from '@sdkwork/models-pc-picker';

export interface UniversalChatComposerFooterCommonProps {
  attachmentMenuRef: RefObject<HTMLDivElement | null>;
  canQueueTypedMessage: boolean;
  canSubmitComposerMessage: boolean;
  canSubmitPendingUserQuestionAnswer: boolean;
  disabled: boolean;
  editingMessage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  isAttachmentMenuOpen: boolean;
  isAwaitingQueuedTurnSettlement: boolean;
  isComposerProcessing: boolean;
  isComposerTurnBlocked: boolean;
  isListening: boolean;
  modelGroups: ModelsPickerGroup[];
  onAttachmentMenuOpenChange: (open: boolean) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onFolderUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenPromptModal: () => void;
  onSelectModel: (pickerId: string) => void;
  onSend: () => void | Promise<void>;
  onToggleVoiceInput: () => void;
  selectedModelLabel: string;
  selectedModelPickerId: string;
  selectedModelSummary: string;
  setShowModelMenu: (open: boolean) => void;
  showModelMenu: boolean;
  showModelPicker: boolean;
}

export interface UniversalChatComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {
  engineId: string;
}

export interface EngineComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {}
