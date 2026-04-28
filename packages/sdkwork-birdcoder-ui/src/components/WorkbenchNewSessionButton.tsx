import { Check, ChevronDown } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import {
  getWorkbenchCodeModelLabel,
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-codeengine';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';

type WorkbenchNewSessionButtonVariant = 'topbar' | 'studio' | 'sidebar';

interface WorkbenchNewSessionButtonProps {
  buttonLabel: string;
  currentSessionEngineId?: string | null;
  currentSessionModelId?: string | null;
  disabled?: boolean;
  disabledTitle?: string;
  menuLabel?: string;
  selectedEngineId: string;
  selectedModelId: string;
  variant: WorkbenchNewSessionButtonVariant;
  onCreateSession: (engineId: string, modelId: string) => void | Promise<void>;
}

interface WorkbenchNewSessionButtonVariantStyle {
  container: string;
  menu: string;
  primaryButton: string;
  secondaryButton: string;
  wrapper: string;
}

function getVariantStyle(
  variant: WorkbenchNewSessionButtonVariant,
): WorkbenchNewSessionButtonVariantStyle {
  switch (variant) {
    case 'studio':
      return {
        container: 'relative flex-1',
        menu:
          'absolute inset-x-0 bottom-full z-10 mb-2 rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl',
        primaryButton:
          'flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-all',
        secondaryButton:
          'flex items-center justify-center border-l px-2 transition-all',
        wrapper: 'flex overflow-hidden rounded-lg border border-dashed border-blue-500/30',
      };
    case 'sidebar':
      return {
        container: 'relative animate-in fade-in slide-in-from-left-4 fill-mode-both',
        menu:
          'absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl',
        primaryButton:
          'flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left transition-all duration-200',
        secondaryButton:
          'flex items-center justify-center border-l border-white/10 px-2 transition-all duration-200',
        wrapper: 'flex overflow-hidden rounded-md transition-all duration-200',
      };
    case 'topbar':
    default:
      return {
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right',
        primaryButton:
          'flex h-8 items-center gap-2 px-3 text-xs font-medium transition-colors',
        secondaryButton:
          'flex h-8 items-center border-l border-white/10 px-2 transition-colors',
        wrapper: 'flex items-stretch overflow-hidden rounded-md border border-white/10 bg-white/5',
      };
  }
}

function WorkbenchNewSessionButtonComponent({
  buttonLabel,
  currentSessionEngineId,
  currentSessionModelId,
  disabled = false,
  disabledTitle,
  menuLabel,
  selectedEngineId,
  selectedModelId,
  variant,
  onCreateSession,
}: WorkbenchNewSessionButtonProps) {
  const { preferences } = useWorkbenchPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const variantStyle = getVariantStyle(variant);
  const { availableEngines, preferredSelection } = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId,
          currentSessionModelId,
          preferredEngineId: selectedEngineId,
          preferredModelId: selectedModelId,
        },
        preferences,
      ),
    [
      currentSessionEngineId,
      currentSessionModelId,
      preferences,
      selectedEngineId,
      selectedModelId,
    ],
  );

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrimaryClick = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsOpen(false);
    void onCreateSession(preferredSelection.engine.id, preferredSelection.modelId);
  }, [
    disabled,
    onCreateSession,
    preferredSelection.engine.id,
    preferredSelection.modelId,
  ]);

  const handleToggleMenu = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsOpen((previousState) => !previousState);
  }, [disabled]);

  const buttonTitle = disabled ? disabledTitle ?? buttonLabel : buttonLabel;
  const resolvedMenuLabel = menuLabel ?? buttonLabel;
  const primaryButtonClassName =
    variant === 'studio'
      ? `${variantStyle.primaryButton} ${
          disabled
            ? 'cursor-not-allowed text-blue-400/40'
            : 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
        }`
      : `${variantStyle.primaryButton} ${
          disabled
            ? 'cursor-not-allowed text-gray-500'
            : variant === 'sidebar'
              ? 'cursor-pointer hover:bg-white/10 hover:text-white'
              : 'text-gray-100 hover:bg-white/10'
        }`;
  const secondaryButtonClassName =
    variant === 'studio'
      ? `${variantStyle.secondaryButton} ${
          disabled
            ? 'cursor-not-allowed border-blue-500/20 text-blue-400/40'
            : 'border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
        }`
      : `${variantStyle.secondaryButton} ${
          disabled
            ? variant === 'sidebar'
              ? 'cursor-not-allowed text-gray-700'
              : 'cursor-not-allowed text-gray-600'
            : variant === 'sidebar'
              ? 'cursor-pointer text-gray-500 hover:bg-white/10 hover:text-white'
              : 'text-gray-400 hover:bg-white/10 hover:text-white'
        }`;
  const wrapperClassName =
    variant === 'sidebar'
      ? `${variantStyle.wrapper} ${disabled ? 'text-gray-600' : 'bg-transparent text-gray-300'}`
      : variantStyle.wrapper;

  return (
    <div ref={menuRef} className={variantStyle.container}>
      <div className={wrapperClassName}>
        <button
          type="button"
          disabled={disabled}
          title={buttonTitle}
          className={primaryButtonClassName}
          onClick={handlePrimaryClick}
        >
          <WorkbenchCodeEngineIcon engineId={preferredSelection.engine.id} />
          <span className="truncate">{buttonLabel}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          title={buttonTitle}
          className={secondaryButtonClassName}
          onClick={handleToggleMenu}
        >
          <ChevronDown
            size={variant === 'studio' ? 12 : 14}
            className={isOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'}
          />
        </button>
      </div>
      {isOpen && !disabled ? (
        <div className={variantStyle.menu}>
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {resolvedMenuLabel}
          </div>
          {availableEngines.map((engine) => {
            const engineModelId = resolveWorkbenchCodeEngineSelectedModelId(
              engine.id,
              preferences,
            );
            const engineModelLabel =
              getWorkbenchCodeModelLabel(engine.id, engineModelId, preferences) ||
              engineModelId;

            return (
              <button
                key={`new-session-engine-${variant}-${engine.id}`}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setIsOpen(false);
                  void onCreateSession(engine.id, engineModelId);
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <WorkbenchCodeEngineIcon engineId={engine.id} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{engine.label}</span>
                    <span className="truncate text-[11px] text-gray-500">
                      {engineModelLabel}
                    </span>
                  </span>
                </div>
                {engine.id === preferredSelection.engine.id ? (
                  <Check size={14} className="shrink-0 text-blue-400" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export const WorkbenchNewSessionButton = memo(WorkbenchNewSessionButtonComponent);
WorkbenchNewSessionButton.displayName = 'WorkbenchNewSessionButton';
