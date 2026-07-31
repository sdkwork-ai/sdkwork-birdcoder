import type { ChangeEvent, RefObject } from 'react';
import type { ModelsPickerGroup } from '@sdkwork/models-pc-picker';
import type { WorkbenchCodeEngineAccessModeDefinition } from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';

export interface UniversalChatComposerFooterCommonProps {
  accessModes: readonly WorkbenchCodeEngineAccessModeDefinition[];
  attachmentsDisabled: boolean;
  canQueueTypedMessage: boolean;
  canStopTurn: boolean;
  canSubmitComposerMessage: boolean;
  canSubmitPendingUserQuestionAnswer: boolean;
  disabled: boolean;
  editingMessage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  isAttachmentMenuOpen: boolean;
  isAccessModeMenuOpen: boolean;
  isComposerProcessing: boolean;
  isComposerTurnBlocked: boolean;
  isListening: boolean;
  isStopTurnConfirmationVisible: boolean;
  isStoppingTurn: boolean;
  isUploadingAttachments: boolean;
  modelGroups: ModelsPickerGroup[];
  onAttachmentMenuOpenChange: (open: boolean) => void;
  onAccessModeMenuOpenChange: (open: boolean) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onFolderUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSelectModel: (pickerId: string) => void;
  onSelectAccessMode: (accessModeId: string) => void;
  onSend: () => void | Promise<void>;
  onStopTurn: () => void | Promise<void>;
  onToggleVoiceInput: () => void;
  selectedModelLabel: string;
  selectedAccessModeId: string;
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
