import { useMemo, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUp,
  Check,
  Loader2,
  Mic,
  Plus,
  Square,
} from 'lucide-react';
import {
  Button,
  WorkbenchCodeEngineIcon,
} from '@sdkwork/birdcoder-pc-ui-shell';
import { UnifiedAgentModelSelector } from '@sdkwork/models-pc-picker';
import { ComposerAccessModeControl } from './ComposerAccessModeControl';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

interface SharedComposerFooterProps extends EngineComposerFooterProps {
  engineId: string;
}

export function SharedComposerFooter({
  accessModes,
  attachmentsDisabled,
  canQueueTypedMessage,
  canStopTurn,
  canSubmitComposerMessage,
  canSubmitPendingUserQuestionAnswer,
  disabled,
  editingMessage,
  engineId,
  fileInputRef,
  folderInputRef,
  imageInputRef,
  isAttachmentMenuOpen,
  isAccessModeMenuOpen,
  isComposerProcessing,
  isComposerTurnBlocked,
  isListening,
  isStopTurnConfirmationVisible,
  isStoppingTurn,
  isUploadingAttachments,
  unifiedAgentModelOptions,
  unifiedAgentProviderOptions,
  onAttachmentMenuOpenChange,
  onAccessModeMenuOpenChange,
  onFileUpload,
  onFolderUpload,
  onImageUpload,
  onCreateUnifiedAgentModelConfiguration,
  onGetUnifiedAgentModelApiKey,
  onSelectUnifiedAgentModel,
  onSelectAccessMode,
  onSend,
  onStopTurn,
  onToggleVoiceInput,
  selectedModelLabel,
  selectedAccessModeId,
  selectedUnifiedAgentModelOptionId,
  selectedModelSummary,
  onUnifiedAgentModelSelectorOpenChange,
  isUnifiedAgentModelSelectorOpen,
  showUnifiedAgentModelSelector,
}: SharedComposerFooterProps) {
  const { t } = useTranslation();
  const attachmentActionDisabled = disabled;
  const attachmentInputDisabled = disabled || attachmentsDisabled;
  const modelSelectorMessages = useMemo(
    () => ({
      addModel: t('chat.unifiedAgentModelSelector.addModel'),
      addModelTitle: t('chat.unifiedAgentModelSelector.addModelTitle'),
      advancedSettings: t('chat.unifiedAgentModelSelector.advancedSettings'),
      apiKeyLabel: t('chat.unifiedAgentModelSelector.apiKeyLabel'),
      apiKeyPlaceholder: t('chat.unifiedAgentModelSelector.apiKeyPlaceholder'),
      apiKeyRequired: t('chat.unifiedAgentModelSelector.apiKeyRequired'),
      baseUrlInvalid: t('chat.unifiedAgentModelSelector.baseUrlInvalid'),
      baseUrlLabel: t('chat.unifiedAgentModelSelector.baseUrlLabel'),
      baseUrlPlaceholder: t('chat.unifiedAgentModelSelector.baseUrlPlaceholder'),
      builtInModels: t('chat.unifiedAgentModelSelector.builtInModels'),
      cancel: t('chat.unifiedAgentModelSelector.cancel'),
      close: t('chat.unifiedAgentModelSelector.close'),
      clearSearch: t('chat.unifiedAgentModelSelector.clearSearch'),
      createFailed: t('chat.unifiedAgentModelSelector.createFailed'),
      creating: t('chat.unifiedAgentModelSelector.creating'),
      customModels: t('chat.unifiedAgentModelSelector.customModels'),
      customTag: t('chat.unifiedAgentModelSelector.customTag'),
      defaultModelLabel: t('chat.unifiedAgentModelSelector.defaultModelLabel'),
      defaultModelPlaceholder: t('chat.unifiedAgentModelSelector.defaultModelPlaceholder'),
      defaultModelRequired: t('chat.unifiedAgentModelSelector.defaultModelRequired'),
      getApiKey: t('chat.unifiedAgentModelSelector.getApiKey'),
      inputContextLabel: t('chat.unifiedAgentModelSelector.inputContextLabel'),
      modelAlreadyExists: t('chat.unifiedAgentModelSelector.modelAlreadyExists'),
      modelSelectorLabel: t('chat.unifiedAgentModelSelector.modelSelectorLabel'),
      multimodalLabel: t('chat.unifiedAgentModelSelector.multimodalLabel'),
      noModels: t('chat.unifiedAgentModelSelector.noModels'),
      noSearchResults: t('chat.unifiedAgentModelSelector.noSearchResults'),
      notSupported: t('chat.unifiedAgentModelSelector.notSupported'),
      outputContextLabel: t('chat.unifiedAgentModelSelector.outputContextLabel'),
      providerRequired: t('chat.unifiedAgentModelSelector.providerRequired'),
      providerSection: t('chat.unifiedAgentModelSelector.providerSection'),
      previewTag: t('chat.unifiedAgentModelSelector.previewTag'),
      searchPlaceholder: t('chat.unifiedAgentModelSelector.searchPlaceholder'),
      selectFailed: t('chat.unifiedAgentModelSelector.selectFailed'),
      submit: t('chat.unifiedAgentModelSelector.submit'),
      supported: t('chat.unifiedAgentModelSelector.supported'),
      supportedModelsLabel: t('chat.unifiedAgentModelSelector.supportedModelsLabel'),
      supportedModelsPlaceholder: t('chat.unifiedAgentModelSelector.supportedModelsPlaceholder'),
      supportedProvidersHint: t('chat.unifiedAgentModelSelector.supportedProvidersHint'),
      toolCallRoundsLabel: t('chat.unifiedAgentModelSelector.toolCallRoundsLabel'),
      useSystemDefaultPlaceholder: t('chat.unifiedAgentModelSelector.useSystemDefaultPlaceholder'),
      vendorLabel: t('chat.unifiedAgentModelSelector.vendorLabel'),
      vendorPlaceholder: t('chat.unifiedAgentModelSelector.vendorPlaceholder'),
      vendorRequired: t('chat.unifiedAgentModelSelector.vendorRequired'),
    }),
    [t],
  );

  return (
    <div
      className="mt-1 flex min-w-0 items-center justify-between gap-3"
      data-composer-engine={engineId}
      data-testid={`${engineId}-composer-footer`}
    >
      <div className="relative flex min-w-0 items-center gap-1 text-xs text-gray-400">
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={isAttachmentMenuOpen}
          aria-haspopup="menu"
          aria-controls={isAttachmentMenuOpen ? 'composer-action-panel' : undefined}
          aria-label={t('chat.addAttachment')}
          className={`h-7 w-7 shrink-0 rounded-lg transition-colors ${attachmentActionDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10 hover:text-white'}`}
          title={t('chat.addAttachment')}
          onClick={() => {
            if (!attachmentActionDisabled) {
              onAttachmentMenuOpenChange(!isAttachmentMenuOpen);
            }
          }}
          disabled={attachmentActionDisabled}
        >
          <Plus aria-hidden="true" size={16} />
        </Button>

        <ComposerAccessModeControl
          accessModes={accessModes}
          disabled={disabled}
          engineId={engineId}
          isOpen={isAccessModeMenuOpen}
          onOpenChange={onAccessModeMenuOpenChange}
          onSelect={onSelectAccessMode}
          selectedAccessModeId={selectedAccessModeId}
        />

        <input
          type="file"
          ref={fileInputRef}
          aria-hidden="true"
          className="hidden"
          disabled={attachmentInputDisabled}
          multiple
          onChange={onFileUpload}
          tabIndex={-1}
        />
        <input
          type="file"
          ref={folderInputRef}
          aria-hidden="true"
          className="hidden"
          disabled={attachmentInputDisabled}
          onChange={onFolderUpload}
          tabIndex={-1}
          {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
        />
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          aria-hidden="true"
          disabled={attachmentInputDisabled}
          multiple
          className="hidden"
          onChange={onImageUpload}
          tabIndex={-1}
        />
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        {showUnifiedAgentModelSelector ? (
          <div
            className="birdcoder-composer-model-selector min-w-0 max-w-[min(46vw,240px)] shrink"
            data-testid="universal-chat-unified-agent-model-selector"
          >
            <UnifiedAgentModelSelector
              activeProviderId={engineId}
              disabled={disabled}
              fallbackLabel={selectedModelLabel}
              messages={modelSelectorMessages}
              onCreateModelConfiguration={onCreateUnifiedAgentModelConfiguration}
              onGetApiKey={onGetUnifiedAgentModelApiKey}
              onOpenChange={onUnifiedAgentModelSelectorOpenChange}
              onSelectModelOption={onSelectUnifiedAgentModel}
              open={isUnifiedAgentModelSelectorOpen}
              options={unifiedAgentModelOptions}
              providerOptions={unifiedAgentProviderOptions}
              renderModelIcon={(option) => (
                <WorkbenchCodeEngineIcon engineId={option.iconKey} size="sm" />
              )}
              selectedModelOptionId={selectedUnifiedAgentModelOptionId}
            />
          </div>
        ) : (
          <div
            className="flex min-w-0 max-w-[min(46vw,240px)] shrink items-center rounded-lg px-2 py-1.5"
            data-testid="universal-chat-selected-model"
            title={selectedModelSummary}
          >
            <span className="min-w-0 truncate text-xs font-semibold text-zinc-200">
              {selectedModelLabel}
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={isListening ? t('chat.stopListening') : t('chat.voiceInput')}
          className={`h-8 w-8 shrink-0 rounded-full transition-colors ${disabled ? 'cursor-not-allowed text-gray-600 opacity-50' : isListening ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title={isListening ? t('chat.stopListening') : t('chat.voiceInput')}
          disabled={disabled}
          onClick={onToggleVoiceInput}
        >
          <Mic size={16} className={isListening ? 'animate-pulse' : ''} />
        </Button>

        {isStoppingTurn ? (
          <Button
            size="icon"
            aria-label={t('chat.stoppingResponse')}
            className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-gray-400 transition-all duration-200"
            disabled
            title={t('chat.stoppingResponse')}
          >
            <Loader2 size={14} className="animate-spin" />
          </Button>
        ) : canStopTurn && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer ? (
          <Button
            size="icon"
            aria-label={t('chat.stopResponse')}
            className={`h-8 shrink-0 rounded-full bg-zinc-100 text-zinc-900 shadow-[0_5px_18px_rgba(255,255,255,0.14)] transition-all duration-200 hover:bg-white ${
              isStopTurnConfirmationVisible ? 'w-[58px] gap-1.5 px-2' : 'w-8'
            }`}
            onClick={() => {
              void onStopTurn();
            }}
            title={t('chat.stopResponse')}
          >
            <Square aria-hidden="true" fill="currentColor" size={11} />
            {isStopTurnConfirmationVisible ? (
              <span aria-hidden="true" className="text-[10px] font-medium leading-none">
                Esc
              </span>
            ) : null}
          </Button>
        ) : isUploadingAttachments ? (
          <Button
            size="icon"
            aria-label={t('chat.attachmentUploading')}
            className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-gray-400 transition-all duration-200"
            disabled
            title={t('chat.attachmentUploading')}
          >
            <Loader2 size={14} className="animate-spin" />
          </Button>
        ) : isComposerProcessing && !editingMessage && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer ? (
          <Button
            size="icon"
            aria-label={t('chat.generatingResponse')}
            className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-gray-400 transition-all duration-200"
            disabled
            title={t('chat.generatingResponse')}
          >
            <Loader2 size={14} className="animate-spin" />
          </Button>
        ) : (
          <Button
            size="icon"
            aria-label={
              editingMessage
                ? t('chat.saveEditedMessage')
                : canSubmitPendingUserQuestionAnswer
                  ? t('chat.submitAnswer')
                  : isComposerTurnBlocked
                    ? t('chat.queueMessage')
                    : t('chat.sendMessage')
            }
            className={`h-8 w-8 shrink-0 rounded-full transition-all duration-200 ${canSubmitComposerMessage ? 'bg-zinc-100 text-zinc-900 shadow-[0_5px_18px_rgba(255,255,255,0.14)] hover:bg-white' : 'bg-white/10 text-gray-500'}`}
            onClick={() => {
              void onSend();
            }}
            disabled={!canSubmitComposerMessage}
            title={
              editingMessage
                ? t('chat.saveEditedMessage')
                : canSubmitPendingUserQuestionAnswer
                  ? t('chat.submitAnswer')
                  : isComposerTurnBlocked
                    ? t('chat.queueMessage')
                    : t('chat.sendMessage')
            }
          >
            {editingMessage ? <Check size={16} /> : <ArrowUp size={16} />}
          </Button>
        )}
      </div>
    </div>
  );
}
