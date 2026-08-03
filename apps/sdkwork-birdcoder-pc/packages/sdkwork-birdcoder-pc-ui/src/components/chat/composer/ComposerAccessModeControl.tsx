import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Check, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { WorkbenchCodeEngineAccessModeDefinition } from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import { FullAccessConfirmationDialog } from './FullAccessConfirmationDialog';

interface ComposerAccessModeControlProps {
  accessModes: readonly WorkbenchCodeEngineAccessModeDefinition[];
  disabled: boolean;
  engineId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (accessModeId: string) => void;
  selectedAccessModeId: string;
}

function getAccessModeIcon(mode: WorkbenchCodeEngineAccessModeDefinition) {
  if (mode.riskLevel === 'unrestricted') {
    return ShieldAlert;
  }
  if (mode.approvalBehavior === 'automatic_review') {
    return ShieldCheck;
  }
  return ShieldQuestion;
}

function getAccessModeTranslationKey(
  engineId: string,
  modeId: string,
  field: 'description' | 'label',
): string {
  return `chat.accessModes.${engineId.replace(/-/gu, '_')}.${modeId}.${field}`;
}

export function ComposerAccessModeControl({
  accessModes,
  disabled,
  engineId,
  isOpen,
  onOpenChange,
  onSelect,
  selectedAccessModeId,
}: ComposerAccessModeControlProps) {
  const { t } = useTranslation();
  const menuId = `composer-access-mode-${useId().replace(/:/gu, '')}`;
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOffsetLeft, setMenuOffsetLeft] = useState(0);
  const [pendingAccessModeId, setPendingAccessModeId] = useState<string | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledModeIndexes = useMemo(
    () => accessModes.flatMap((mode, index) => mode.enabled ? [index] : []),
    [accessModes],
  );
  const selectedIndex = accessModes.findIndex(
    (mode) => mode.id === selectedAccessModeId && mode.enabled,
  );
  const selectedMode = accessModes[selectedIndex]
    ?? accessModes.find((mode) => mode.enabled)
    ?? accessModes[0];
  const controlDisabled = disabled || enabledModeIndexes.length === 0;
  const selectedLabel = selectedMode
    ? t(getAccessModeTranslationKey(engineId, selectedMode.id, 'label'), {
        defaultValue: selectedMode.displayName,
      })
    : t('chat.accessModeUnavailable');
  const SelectedIcon = selectedMode ? getAccessModeIcon(selectedMode) : ShieldQuestion;
  const isUnrestricted = selectedMode?.riskLevel === 'unrestricted';

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateMenuOffset = () => {
      const menu = menuRef.current;
      const root = rootRef.current;
      if (!menu || !root) {
        return;
      }
      const viewportGutter = 16;
      const menuRect = menu.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const maximumLeft = Math.max(
        viewportGutter,
        window.innerWidth - viewportGutter - menuRect.width,
      );
      const viewportLeft = Math.min(
        Math.max(rootRect.left, viewportGutter),
        maximumLeft,
      );
      setMenuOffsetLeft(viewportLeft - rootRect.left);
    };

    updateMenuOffset();
    window.addEventListener('resize', updateMenuOffset);
    return () => window.removeEventListener('resize', updateMenuOffset);
  }, [isOpen]);

  const closeAndRestoreFocus = () => {
    onOpenChange(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const closeConfirmationAndRestoreFocus = () => {
    setPendingAccessModeId(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleModeSelect = (mode: WorkbenchCodeEngineAccessModeDefinition) => {
    if (mode.riskLevel === 'unrestricted' && mode.id !== selectedMode?.id) {
      onOpenChange(false);
      setPendingAccessModeId(mode.id);
      return;
    }

    onSelect(mode.id);
    closeAndRestoreFocus();
  };

  const focusModeAt = (index: number) => {
    itemRefs.current[index]?.focus();
  };

  const focusRelativeMode = (currentIndex: number, offset: number) => {
    if (enabledModeIndexes.length === 0) {
      return;
    }
    const enabledIndex = enabledModeIndexes.indexOf(currentIndex);
    const startIndex = enabledIndex >= 0
      ? enabledIndex
      : Math.max(0, enabledModeIndexes.indexOf(selectedIndex));
    const nextIndex = (startIndex + offset + enabledModeIndexes.length) % enabledModeIndexes.length;
    focusModeAt(enabledModeIndexes[nextIndex] ?? enabledModeIndexes[0]!);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const initialIndex = selectedIndex >= 0 ? selectedIndex : enabledModeIndexes[0];
    if (initialIndex !== undefined) {
      window.requestAnimationFrame(() => focusModeAt(initialIndex));
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabledModeIndexes, isOpen, onOpenChange, selectedIndex]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (controlDisabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      onOpenChange(true);
      const initialIndex = selectedIndex >= 0 ? selectedIndex : enabledModeIndexes[0];
      if (initialIndex !== undefined) {
        window.requestAnimationFrame(() => focusModeAt(initialIndex));
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenChange(!isOpen);
    }
  };

  const handleItemKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRelativeMode(index, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelativeMode(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusModeAt(enabledModeIndexes[0]!);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusModeAt(enabledModeIndexes[enabledModeIndexes.length - 1]!);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 max-w-[min(44vw,220px)] shrink"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('chat.accessModeControl', { mode: selectedLabel })}
        className={`flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-[420px]:w-8 max-[420px]:justify-center max-[420px]:px-0 ${
          isUnrestricted
            ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 hover:text-orange-300'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
        }`}
        data-access-mode-id={selectedMode?.id ?? ''}
        data-testid="composer-access-mode-trigger"
        disabled={controlDisabled}
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        title={selectedLabel}
      >
        <SelectedIcon aria-hidden="true" className="shrink-0" size={15} />
        <span className="min-w-0 truncate max-[420px]:hidden">{selectedLabel}</span>
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('chat.accessModeMenu')}
          className="absolute bottom-full z-50 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-[#242426] p-1.5 shadow-2xl"
          data-testid="composer-access-mode-menu"
          style={{ left: `${menuOffsetLeft}px` }}
        >
          {accessModes.map((mode, index) => {
            const Icon = getAccessModeIcon(mode);
            const label = t(getAccessModeTranslationKey(engineId, mode.id, 'label'), {
              defaultValue: mode.displayName,
            });
            const description = mode.enabled
              ? t(getAccessModeTranslationKey(engineId, mode.id, 'description'), {
                  defaultValue: mode.description,
                })
              : mode.disabledReason || mode.description;
            const selected = mode.id === selectedMode?.id;
            const unrestricted = mode.riskLevel === 'unrestricted';
            return (
              <button
                key={mode.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-disabled={!mode.enabled}
                className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                  mode.enabled
                    ? 'hover:bg-white/7 focus-visible:bg-white/7 focus-visible:outline-none'
                    : 'cursor-not-allowed opacity-45'
                } ${unrestricted ? 'text-orange-400' : 'text-zinc-200'}`}
                data-access-mode-option={mode.id}
                disabled={!mode.enabled}
                onClick={() => {
                  if (!mode.enabled) {
                    return;
                  }
                  handleModeSelect(mode);
                }}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                title={!mode.enabled ? description : undefined}
              >
                <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-5">{label}</span>
                  <span className={`block text-xs leading-4 ${unrestricted ? 'text-orange-400' : 'text-zinc-400'}`}>
                    {description}
                  </span>
                </span>
                {selected ? <Check aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <FullAccessConfirmationDialog
        isOpen={pendingAccessModeId !== null}
        onCancel={closeConfirmationAndRestoreFocus}
        onConfirm={() => {
          if (pendingAccessModeId) {
            onSelect(pendingAccessModeId);
          }
          closeConfirmationAndRestoreFocus();
        }}
      />
    </div>
  );
}
