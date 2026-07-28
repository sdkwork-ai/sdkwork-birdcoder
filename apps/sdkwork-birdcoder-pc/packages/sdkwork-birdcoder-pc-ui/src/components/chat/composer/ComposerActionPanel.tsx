import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  FileUp,
  FolderUp,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  PlugZap,
  Sparkles,
} from 'lucide-react';
import type {
  ComposerProviderCapabilities,
  ComposerProviderCapabilityItem,
} from '@sdkwork/birdcoder-pc-workbench';

export type ComposerCapabilityKind = 'plugin' | 'skill';

export interface ComposerActionPanelProps {
  attachmentsDisabled: boolean;
  capabilities: ComposerProviderCapabilities;
  error?: Error | null;
  isLoading: boolean;
  onClose: () => void;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenImages: () => void;
  onOpenPrompts: () => void;
  onRetry: () => void;
  onSelectCapability: (
    kind: ComposerCapabilityKind,
    item: ComposerProviderCapabilityItem,
  ) => void;
  providerLabel: string;
}

interface ActionRowProps {
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function ActionRow({ description, disabled = false, icon, label, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-zinc-200 transition-colors focus-visible:outline-none ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : 'hover:bg-white/[0.09] focus-visible:bg-white/[0.09]'
      }`}
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors group-hover:bg-white/[0.08] group-hover:text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-zinc-100">{label}</span>
        <span className="block truncate text-xs text-zinc-500">{description}</span>
      </span>
    </button>
  );
}

interface CapabilitySectionProps {
  emptyLabel: string;
  errors?: string[];
  icon: ReactNode;
  items: ComposerProviderCapabilityItem[];
  kind: ComposerCapabilityKind;
  onSelect: ComposerActionPanelProps['onSelectCapability'];
  onRetry: ComposerActionPanelProps['onRetry'];
  title: string;
}

function CapabilitySection({
  emptyLabel,
  icon,
  items,
  kind,
  onSelect,
  onRetry,
  title,
  errors = [],
}: CapabilitySectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-label={title} className="mt-1">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-[#2a2a2d]/95 px-3 py-2 text-xs font-semibold text-zinc-500 backdrop-blur-sm">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-zinc-600">{emptyLabel}</p>
      ) : (
        <div className="py-1">
          {items.map((item) => (
            <button
              key={`${kind}:${item.id}`}
              type="button"
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none ${
                item.enabled
                  ? 'hover:bg-white/[0.09] focus-visible:bg-white/[0.09]'
                  : 'cursor-not-allowed opacity-45'
              }`}
              disabled={!item.enabled}
              onClick={() => onSelect(kind, item)}
              role="menuitem"
              title={item.description}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                kind === 'plugin'
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'bg-violet-500/10 text-violet-300'
              }`}>
                {kind === 'plugin' ? <PlugZap size={14} /> : <Sparkles size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-zinc-200">
                    {item.name}
                  </span>
                  {item.enabled ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Check size={9} />
                      {t('chat.capabilityEnabled')}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-500">
                      {t('chat.capabilityUnavailable')}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {errors.length > 0 ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.05] px-2.5 py-2 text-[11px] text-amber-100/70" role="status">
          <AlertCircle className="mt-0.5 shrink-0" size={13} />
          <span className="min-w-0 flex-1">{errors.join(' ')}</span>
          <button type="button" className="shrink-0 text-amber-100/80 underline-offset-2 hover:underline" onClick={onRetry}>{t('chat.retryProviderCapabilities')}</button>
        </div>
      ) : null}
    </section>
  );
}

export function ComposerActionPanel({
  attachmentsDisabled,
  capabilities,
  error,
  isLoading,
  onClose,
  onOpenFiles,
  onOpenFolder,
  onOpenImages,
  onOpenPrompts,
  onRetry,
  onSelectCapability,
  providerLabel,
}: ComposerActionPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t('chat.composerActions')}
      className="mb-2 w-full overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#2a2a2d] text-zinc-200 shadow-[0_24px_70px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-2 duration-150"
      data-composer-action-panel="true"
      data-testid="composer-action-panel"
      id="composer-action-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      role="menu"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <span className="text-sm font-semibold text-zinc-400">{t('chat.add')}</span>
        <span className="max-w-[60%] truncate rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
          {t('chat.providerCapabilities', { provider: providerLabel })}
        </span>
      </div>

      <div className="max-h-[min(58vh,440px)] overflow-y-auto px-2 pb-2 custom-scrollbar">
        <div className="space-y-0.5">
          <ActionRow
            description={t('chat.composerFilesDescription')}
            disabled={attachmentsDisabled}
            icon={<FileUp size={15} />}
            label={t('chat.composerFiles')}
            onClick={onOpenFiles}
          />
          <ActionRow
            description={t('chat.composerFolderDescription')}
            disabled={attachmentsDisabled}
            icon={<FolderUp size={15} />}
            label={t('chat.composerFolder')}
            onClick={onOpenFolder}
          />
          <ActionRow
            description={t('chat.composerImagesDescription')}
            disabled={attachmentsDisabled}
            icon={<ImageIcon size={15} />}
            label={t('chat.composerImages')}
            onClick={onOpenImages}
          />
          <ActionRow
            description={t('chat.composerPromptsDescription')}
            icon={<Lightbulb size={15} />}
            label={t('chat.prompts')}
            onClick={onOpenPrompts}
          />
        </div>

        {isLoading ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-4 text-xs text-zinc-500" role="status">
            <Loader2 className="animate-spin" size={14} />
            <span>{t('chat.loadingProviderCapabilities')}</span>
          </div>
        ) : (
          <>
            <CapabilitySection
              emptyLabel={t('chat.noProviderPlugins')}
              errors={capabilities.errors.filter((item) => item.source === 'local' || item.message.toLowerCase().includes('plugin')).map((item) => item.message)}
              icon={<PlugZap size={13} />}
              items={capabilities.plugins}
              kind="plugin"
              onSelect={onSelectCapability}
              onRetry={onRetry}
              title={t('chat.plugins')}
            />
            <CapabilitySection
              emptyLabel={t('chat.noProviderSkills')}
              errors={capabilities.errors.filter((item) => item.source === 'remote' && item.message.toLowerCase().includes('skill')).map((item) => item.message)}
              icon={<Sparkles size={13} />}
              items={capabilities.skills}
              kind="skill"
              onSelect={onSelectCapability}
              onRetry={onRetry}
              title={t('chat.skills')}
            />
          </>
        )}
      </div>
    </div>
  );
}
