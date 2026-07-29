import { Check, ChevronDown, SquarePen } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import {
  getWorkbenchCodeModelLabel,
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-pc-ui-shell';

type WorkbenchNewSessionButtonVariant = 'topbar' | 'studio' | 'sidebar';

interface WorkbenchNewSessionButtonProps {
  buttonLabel: string;
  compact?: boolean;
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
        container: 'relative w-full animate-in fade-in slide-in-from-left-4 fill-mode-both',
        menu:
          'birdcoder-chrome-menu absolute inset-x-0 top-full z-50 mt-1 w-auto rounded-lg border py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl',
        primaryButton:
          'flex h-9 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left text-sm font-medium transition-colors duration-150',
        secondaryButton: 'hidden',
        wrapper: 'flex w-full',
      };
    case 'topbar':
    default:
      return {
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'birdcoder-chrome-menu absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right',
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
  compact = false,
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
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sidebarCloseTimerRef = useRef<number | null>(null);
  const variantStyle = getVariantStyle(variant);
  const isCompactStudio = variant === 'studio' && compact;
  const isSidebar = variant === 'sidebar';
  const { availableEngines, preferredSelection } = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId: isSidebar ? undefined : currentSessionEngineId,
          currentSessionModelId: isSidebar ? undefined : currentSessionModelId,
          preferredEngineId: selectedEngineId,
          preferredModelId: selectedModelId,
        },
        preferences,
      ),
    [
      currentSessionEngineId,
      currentSessionModelId,
      isSidebar,
      preferences,
      selectedEngineId,
      selectedModelId,
    ],
  );

  const clearSidebarCloseTimer = useCallback(() => {
    if (sidebarCloseTimerRef.current !== null) {
      window.clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = null;
    }
  }, []);

  const openSidebarMenu = useCallback(() => {
    if (!isSidebar || disabled || availableEngines.length === 0) {
      return;
    }

    clearSidebarCloseTimer();
    setIsOpen(true);
  }, [availableEngines.length, clearSidebarCloseTimer, disabled, isSidebar]);

  const scheduleSidebarMenuClose = useCallback(() => {
    if (!isSidebar) {
      return;
    }

    clearSidebarCloseTimer();
    sidebarCloseTimerRef.current = window.setTimeout(() => {
      sidebarCloseTimerRef.current = null;
      setIsOpen(false);
    }, 120);
  }, [clearSidebarCloseTimer, isSidebar]);

  const focusMenuItem = useCallback((index: number) => {
    window.requestAnimationFrame(() => {
      menuItemRefs.current[index]?.focus();
    });
  }, []);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsOpen(false);
  }, [disabled]);

  useEffect(() => () => clearSidebarCloseTimer(), [clearSidebarCloseTimer]);

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

    clearSidebarCloseTimer();
    setIsOpen(false);
    void onCreateSession(preferredSelection.engine.id, preferredSelection.modelId);
  }, [
    clearSidebarCloseTimer,
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

  const handlePrimaryKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isSidebar || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
      return;
    }

    event.preventDefault();
    openSidebarMenu();
    focusMenuItem(event.key === 'ArrowUp' ? availableEngines.length - 1 : 0);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const activeIndex = menuItemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSidebarCloseTimer();
      setIsOpen(false);
      primaryButtonRef.current?.focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(availableEngines.length - 1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (
        activeIndex + direction + availableEngines.length
      ) % availableEngines.length;
      focusMenuItem(nextIndex);
    }
  };

  const buttonTitle = disabled ? disabledTitle ?? buttonLabel : buttonLabel;
  const resolvedMenuLabel = menuLabel ?? buttonLabel;
  const primaryButtonClassName =
    variant === 'studio'
      ? `${variantStyle.primaryButton} ${
          disabled
            ? isCompactStudio
              ? 'cursor-not-allowed text-gray-500'
              : 'cursor-not-allowed text-blue-400/40'
            : isCompactStudio
              ? 'text-gray-200 hover:bg-white/[0.04] hover:text-white'
              : 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
        } ${isCompactStudio ? '!h-7 !gap-1.5 !px-2.5 !py-0' : ''}`
      : `${variantStyle.primaryButton} ${
          disabled
            ? 'cursor-not-allowed text-gray-500'
            : variant === 'sidebar'
              ? 'cursor-pointer text-gray-200 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline-none'
              : 'text-gray-100 hover:bg-white/10'
        } ${variant === 'topbar' && compact ? '!gap-0 !px-2' : ''}`;
  const secondaryButtonClassName =
    variant === 'studio'
      ? `${variantStyle.secondaryButton} ${
          disabled
            ? isCompactStudio
              ? 'cursor-not-allowed border-white/[0.05] text-gray-600'
              : 'cursor-not-allowed border-blue-500/20 text-blue-400/40'
            : isCompactStudio
              ? 'border-white/[0.07] text-gray-500 hover:bg-white/[0.05] hover:text-gray-200'
              : 'border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
        } ${isCompactStudio ? '!h-7 !px-1.5' : ''}`
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
      ? `${variantStyle.wrapper} ${disabled ? 'text-gray-600' : 'text-gray-200'}`
      : isCompactStudio
        ? `${variantStyle.wrapper} !rounded-md !border-0 !bg-white/[0.07]`
        : variantStyle.wrapper;
  const menuClassName = isCompactStudio
    ? `${variantStyle.menu} !bottom-auto !left-auto !right-0 !top-full !mb-0 !mt-1.5 !w-64`
    : variantStyle.menu;

  return (
    <div
      ref={menuRef}
      className={`${variantStyle.container} ${isCompactStudio ? '!flex-none' : ''} shrink-0 whitespace-nowrap`}
      data-sidebar-new-session-entry={isSidebar ? 'true' : undefined}
      onMouseEnter={isSidebar ? openSidebarMenu : undefined}
      onMouseLeave={isSidebar ? scheduleSidebarMenuClose : undefined}
    >
      <div className={wrapperClassName}>
        <button
          ref={primaryButtonRef}
          type="button"
          disabled={disabled}
          title={buttonTitle}
          aria-label={buttonLabel}
          aria-expanded={isSidebar ? isOpen : undefined}
          aria-haspopup={isSidebar ? 'menu' : undefined}
          className={primaryButtonClassName}
          data-sidebar-new-session-trigger={isSidebar ? 'true' : undefined}
          onClick={handlePrimaryClick}
          onKeyDown={handlePrimaryKeyDown}
        >
          {isSidebar ? (
            <SquarePen size={18} className="shrink-0 text-gray-300" aria-hidden="true" />
          ) : (
            <span className="shrink-0">
              <WorkbenchCodeEngineIcon engineId={preferredSelection.engine.id} />
            </span>
          )}
          {variant !== 'topbar' || !compact ? (
            <span className="truncate">{buttonLabel}</span>
          ) : null}
        </button>
        {!isSidebar ? (
          <button
            type="button"
            disabled={disabled}
            title={buttonTitle}
            aria-label={resolvedMenuLabel}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            className={secondaryButtonClassName}
            onClick={handleToggleMenu}
          >
            <ChevronDown
              size={variant === 'studio' ? 12 : 14}
              className={isOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'}
            />
          </button>
        ) : null}
      </div>
      {isOpen && !disabled ? (
        <div
          aria-label={resolvedMenuLabel}
          className={menuClassName}
          data-sidebar-new-session-menu={isSidebar ? 'true' : undefined}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          onMouseEnter={isSidebar ? clearSidebarCloseTimer : undefined}
          onMouseLeave={isSidebar ? scheduleSidebarMenuClose : undefined}
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {resolvedMenuLabel}
          </div>
          {availableEngines.map((engine, index) => {
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
                ref={(element) => {
                  menuItemRefs.current[index] = element;
                }}
                type="button"
                aria-checked={engine.id === preferredSelection.engine.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/10 hover:text-white"
                role="menuitemradio"
                onClick={() => {
                  clearSidebarCloseTimer();
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

