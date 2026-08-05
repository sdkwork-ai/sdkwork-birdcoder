import { Check, ChevronDown } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkbenchAgentEngineIcon } from '@sdkwork/birdcoder-pc-ui-shell';

export interface UniversalChatNewSessionProviderOption {
  engineId: string;
  label: string;
  modelLabel: string;
}

interface UniversalChatNewSessionProviderSelectorProps {
  disabled?: boolean;
  options: readonly UniversalChatNewSessionProviderOption[];
  selectedEngineId: string;
  onSelectProvider: (engineId: string) => void;
}

export const UniversalChatNewSessionProviderSelector = memo(
  function UniversalChatNewSessionProviderSelector({
    disabled = false,
    options,
    selectedEngineId,
    onSelectProvider,
  }: UniversalChatNewSessionProviderSelectorProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const selectedOption = options.find((option) => option.engineId === selectedEngineId);
    const selectedProviderLabel = selectedOption?.label || selectedEngineId || '-';
    const isMenuDisabled = disabled || options.length === 0;
    const currentProviderLabel = t('chat.newSessionProviderCurrent', {
      provider: selectedProviderLabel,
    });

    useEffect(() => {
      if (!isMenuDisabled) {
        return;
      }

      setIsOpen(false);
    }, [isMenuDisabled]);

    useEffect(() => {
      if (!isOpen) {
        return undefined;
      }

      const handlePointerDown = (event: MouseEvent) => {
        if (!containerRef.current?.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') {
          return;
        }

        setIsOpen(false);
        triggerRef.current?.focus();
      };

      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    return (
      <div ref={containerRef} className="relative ml-auto shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={currentProviderLabel}
          className="inline-flex h-8 max-w-[min(18rem,62vw)] items-center gap-2 rounded-md bg-transparent px-2.5 text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="universal-chat-new-session-provider-selector"
          data-variant="flat"
          disabled={isMenuDisabled}
          title={selectedProviderLabel}
          onClick={() => setIsOpen((previousState) => !previousState)}
        >
          <WorkbenchAgentEngineIcon engineId={selectedEngineId} />
          <span className="min-w-0 truncate text-xs font-medium text-gray-100">
            {selectedProviderLabel}
          </span>
          <ChevronDown
            size={13}
            className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && !isMenuDisabled ? (
          <div
            aria-label={t('chat.selectNewSessionProvider')}
            className="birdcoder-chrome-menu absolute right-0 top-full z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-md py-1 text-sm text-gray-300 shadow-xl backdrop-blur-xl"
            role="menu"
          >
            {options.map((option) => {
              const isSelected = option.engineId === selectedEngineId;
              const optionLabel = t('chat.newSessionProviderOption', {
                model: option.modelLabel,
                provider: option.label,
              });

              return (
                <button
                  key={option.engineId}
                  type="button"
                  aria-checked={isSelected}
                  aria-label={optionLabel}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-none"
                  role="menuitemradio"
                  onClick={() => {
                    onSelectProvider(option.engineId);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <WorkbenchAgentEngineIcon engineId={option.engineId} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-gray-100">{option.label}</span>
                      <span className="truncate text-[11px] text-gray-500">
                        {option.modelLabel}
                      </span>
                    </span>
                  </span>
                  {isSelected ? <Check size={14} className="shrink-0 text-blue-400" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  },
);

UniversalChatNewSessionProviderSelector.displayName =
  'UniversalChatNewSessionProviderSelector';
