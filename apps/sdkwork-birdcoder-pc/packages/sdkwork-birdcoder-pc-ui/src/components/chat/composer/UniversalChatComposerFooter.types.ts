import type { ChangeEvent, RefObject } from 'react';
import type {
  AgentModelConfigurationDraft,
  UnifiedAgentModelOption,
  UnifiedAgentProviderOption,
} from '@sdkwork/models-pc-picker';
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
  unifiedAgentModelOptions: UnifiedAgentModelOption[];
  unifiedAgentProviderOptions: UnifiedAgentProviderOption[];
  onAttachmentMenuOpenChange: (open: boolean) => void;
  onAccessModeMenuOpenChange: (open: boolean) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onFolderUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSelectUnifiedAgentModel: (option: UnifiedAgentModelOption) => void | Promise<void>;
  onCreateUnifiedAgentModelConfiguration: (
    draft: AgentModelConfigurationDraft,
  ) => void | Promise<void>;
  onGetUnifiedAgentModelApiKey?: (vendorCode: string) => void;
  onSelectAccessMode: (accessModeId: string) => void;
  onSend: () => void | Promise<void>;
  onStopTurn: () => void | Promise<void>;
  onToggleVoiceInput: () => void;
  selectedModelLabel: string;
  selectedAccessModeId: string;
  selectedUnifiedAgentModelOptionId: string;
  selectedModelSummary: string;
  onUnifiedAgentModelSelectorOpenChange: (open: boolean) => void;
  isUnifiedAgentModelSelectorOpen: boolean;
  showUnifiedAgentModelSelector: boolean;
}

export interface UniversalChatComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {
  engineId: string;
}

export interface EngineComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {}
