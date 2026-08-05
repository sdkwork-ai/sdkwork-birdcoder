import type { ChangeEvent, RefObject } from 'react';
import type {
  AgentModelAccessSelection,
  AgentModelAccessSelectionOutcome,
  AgentModelCatalogOption,
  AgentProviderOption,
  ModelAccessApiKeyRequestContext,
  ModelAccessChannel,
  ModelAccessChannelConfigurationDraft,
} from '@sdkwork/models-pc-picker';
import type { WorkbenchAgentEngineAccessModeDefinition } from '@sdkwork/birdcoder-pc-workbench/workbench/agentEngineCatalog';

export interface UniversalChatComposerFooterCommonProps {
  accessModes: readonly WorkbenchAgentEngineAccessModeDefinition[];
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
  agentModelOptions: AgentModelCatalogOption[];
  agentProviderOptions: AgentProviderOption[];
  modelAccessChannels: ModelAccessChannel[];
  onAttachmentMenuOpenChange: (open: boolean) => void;
  onAccessModeMenuOpenChange: (open: boolean) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onFolderUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSelectAgentModelAccess: (
    selection: AgentModelAccessSelection,
  ) => AgentModelAccessSelectionOutcome | Promise<AgentModelAccessSelectionOutcome>;
  onCreateModelAccessChannel: (
    draft: ModelAccessChannelConfigurationDraft,
  ) => void | Promise<void>;
  onUpdateModelAccessChannel: (
    draft: ModelAccessChannelConfigurationDraft,
  ) => void | Promise<void>;
  onDeleteModelAccessChannel?: (
    channel: ModelAccessChannel,
  ) => void | Promise<void>;
  onGetModelAccessApiKey?: (context: ModelAccessApiKeyRequestContext) => void;
  onModelAccessSearchQueryChange?: (query: string) => void;
  isModelAccessSearchLoading?: boolean;
  onSelectAccessMode: (accessModeId: string) => void;
  onSend: () => void | Promise<void>;
  onStopTurn: () => void | Promise<void>;
  onToggleVoiceInput: () => void;
  selectedModelLabel: string;
  selectedAccessModeId: string;
  selectedAgentModelOptionId: string;
  selectedModelAccessChannelId?: string;
  selectedModelSummary: string;
  onAgentModelAccessSelectorOpenChange: (open: boolean) => void;
  isAgentModelAccessSelectorOpen: boolean;
  showAgentModelAccessSelector: boolean;
}

export interface UniversalChatComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {
  engineId: string;
}

export interface EngineComposerFooterProps
  extends UniversalChatComposerFooterCommonProps {}
