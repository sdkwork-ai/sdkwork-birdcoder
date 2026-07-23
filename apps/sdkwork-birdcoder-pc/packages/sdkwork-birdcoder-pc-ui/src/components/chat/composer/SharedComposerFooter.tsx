import { useMemo, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUp,
  Check,
  FileUp,
  FolderUp,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Mic,
  Plus,
} from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { createFallbackModel, ModelPicker } from '@sdkwork/models-pc-picker';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

interface SharedComposerFooterProps extends EngineComposerFooterProps {
  engineId: string;
}

export function SharedComposerFooter({
  attachmentMenuRef,
  canQueueTypedMessage,
  canSubmitComposerMessage,
  canSubmitPendingUserQuestionAnswer,
  disabled,
  editingMessage,
  engineId,
  fileInputRef,
  folderInputRef,
  imageInputRef,
  isAttachmentMenuOpen,
  isAwaitingQueuedTurnSettlement,
  isComposerProcessing,
  isComposerTurnBlocked,
  isListening,
  modelGroups,
  onAttachmentMenuOpenChange,
  onFileUpload,
  onFolderUpload,
  onImageUpload,
  onOpenPromptModal,
  onSelectModel,
  onSend,
  onToggleVoiceInput,
  selectedModelLabel,
  selectedModelPickerId,
  selectedModelSummary,
  setShowModelMenu,
  showModelMenu,
  showModelPicker,
}: SharedComposerFooterProps) {
  const { t } = useTranslation();
  const fallbackWorkbenchModel = useMemo(
    () => createFallbackModel(
      t('chat.modelCatalogFallback'),
      t('chat.modelCatalogLoading'),
      'workspace',
      'llms',
      'BirdCoder',
    ),
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
          className={`h-7 w-7 rounded-lg transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10 hover:text-white'}`}
          title={t('chat.addAttachment')}
          onClick={() => {
            if (!disabled) {
              onAttachmentMenuOpenChange(!isAttachmentMenuOpen);
            }
          }}
          disabled={disabled}
        >
          <Plus size={16} />
        </Button>

        {isAttachmentMenuOpen && !disabled ? (
          <div
            ref={attachmentMenuRef}
            className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-lg bg-[#29292e] py-1.5 text-sm text-gray-300 shadow-[0_18px_52px_rgba(0,0,0,0.46)] animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/10"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={14} />
              <span className="text-xs">{t('chat.uploadFile')}</span>
            </button>
            <button
              type="button"
              className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/10"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp size={14} />
              <span className="text-xs">{t('chat.uploadFolder')}</span>
            </button>
            <button
              type="button"
              className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/10"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon size={14} />
              <span className="text-xs">{t('chat.uploadImage')}</span>
            </button>
          </div>
        ) : null}

        <input type="file" ref={fileInputRef} className="hidden" onChange={onFileUpload} />
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          onChange={onFolderUpload}
          {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
        />
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          className="hidden"
          onChange={onImageUpload}
        />

        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-lg transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10 hover:text-white'}`}
          title={t('chat.prompts')}
          onClick={() => {
            if (!disabled) {
              onOpenPromptModal();
            }
          }}
          disabled={disabled}
        >
          <Lightbulb size={16} />
        </Button>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        {showModelPicker ? (
          <div
            className="birdcoder-composer-model-picker min-w-20 max-w-[min(46vw,240px)]"
            data-testid="universal-chat-model-picker"
          >
            <ModelPicker
              bucket="llms"
              compact
              disabled={disabled}
              fallback={fallbackWorkbenchModel}
              menuPlacement="auto"
              modelGroups={modelGroups}
              onSelectModel={onSelectModel}
              selectedModelId={selectedModelPickerId}
              setShowModelMenu={setShowModelMenu}
              showModelDescription
              showModelMenu={showModelMenu}
              variant="flat"
            />
          </div>
        ) : (
          <div
            className="flex min-w-12 max-w-[min(46vw,240px)] items-center rounded-lg px-2 py-1.5"
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
          className={`h-8 w-8 rounded-full transition-colors ${disabled ? 'cursor-not-allowed text-gray-600 opacity-50' : isListening ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title={isListening ? t('chat.stopListening') : t('chat.voiceInput')}
          disabled={disabled}
          onClick={onToggleVoiceInput}
        >
          <Mic size={16} className={isListening ? 'animate-pulse' : ''} />
        </Button>

        {isComposerProcessing && !editingMessage && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer ? (
          <Button
            size="icon"
            className="h-8 w-8 rounded-full bg-white/10 text-gray-400 transition-all duration-200"
            disabled
            title={t('chat.generatingResponse')}
          >
            <Loader2 size={14} className="animate-spin" />
          </Button>
        ) : (
          <Button
            size="icon"
            className={`h-8 w-8 rounded-full transition-all duration-200 ${canSubmitComposerMessage ? 'bg-zinc-100 text-zinc-900 shadow-[0_5px_18px_rgba(255,255,255,0.14)] hover:bg-white' : 'bg-white/10 text-gray-500'}`}
            onClick={() => {
              void onSend();
            }}
            disabled={!canSubmitComposerMessage}
            title={
              editingMessage
                ? t('chat.saveEditedMessage')
                : canSubmitPendingUserQuestionAnswer
                  ? t('chat.submitAnswer')
                  : isComposerTurnBlocked || isAwaitingQueuedTurnSettlement
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
