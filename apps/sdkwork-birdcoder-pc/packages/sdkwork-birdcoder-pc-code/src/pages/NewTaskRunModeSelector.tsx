import {
  Check,
  ChevronDown,
  Cloud,
  Monitor,
} from 'lucide-react';
import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type NewTaskExecutionTarget = 'LOCAL' | 'CLOUD';

interface RunModePopoverPosition extends CSSProperties {
  bottom?: number;
  left: number;
  top?: number;
  width: number;
}

function resolveRunModePopoverPosition(trigger: HTMLElement): RunModePopoverPosition {
  const triggerBounds = trigger.getBoundingClientRect();
  const viewportGutter = 12;
  const popoverGap = 8;
  const preferredPopoverHeight = 188;
  const availableAbove = triggerBounds.top - viewportGutter;
  const availableBelow = window.innerHeight - triggerBounds.bottom - viewportGutter;
  const shouldOpenAbove =
    availableAbove >= preferredPopoverHeight || availableAbove >= availableBelow;
  const width = Math.min(320, window.innerWidth - viewportGutter * 2);
  const left = Math.max(
    viewportGutter,
    Math.min(triggerBounds.left, window.innerWidth - width - viewportGutter),
  );

  return {
    bottom: shouldOpenAbove
      ? window.innerHeight - triggerBounds.top + popoverGap
      : undefined,
    left,
    top: shouldOpenAbove ? undefined : triggerBounds.bottom + popoverGap,
    width,
  };
}

interface NewTaskRunModeSelectorProps {
  cloudExecutionAvailable: boolean;
  executionTarget: NewTaskExecutionTarget;
  localExecutionAvailable: boolean;
  onExecutionTargetChange: (executionTarget: NewTaskExecutionTarget) => void;
}

export function NewTaskRunModeSelector({
  cloudExecutionAvailable,
  executionTarget,
  localExecutionAvailable,
  onExecutionTargetChange,
}: NewTaskRunModeSelectorProps) {
  const { t } = useTranslation();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<RunModePopoverPosition | null>(null);
  const isLocal = executionTarget === 'LOCAL';

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePosition = () => {
      if (triggerRef.current) {
        setPosition(resolveRunModePopoverPosition(triggerRef.current));
      }
    };
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition);
    resizeObserver?.observe(document.documentElement);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const selectedTargetAvailable = isLocal
      ? localExecutionAvailable
      : cloudExecutionAvailable;
    if (selectedTargetAvailable) {
      return;
    }
    if (localExecutionAvailable) {
      onExecutionTargetChange('LOCAL');
    } else if (cloudExecutionAvailable) {
      onExecutionTargetChange('CLOUD');
    }
  }, [
    cloudExecutionAvailable,
    isLocal,
    localExecutionAvailable,
    onExecutionTargetChange,
  ]);

  const selectExecutionTarget = (nextTarget: NewTaskExecutionTarget) => {
    if (
      (nextTarget === 'LOCAL' && !localExecutionAvailable)
      || (nextTarget === 'CLOUD' && !cloudExecutionAvailable)
    ) {
      return;
    }
    onExecutionTargetChange(nextTarget);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('app.selectNewTaskRunMode')}
        className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          isOpen ? 'bg-white/[0.09] text-white' : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
        }`}
        data-new-task-run-mode-trigger="true"
        onClick={() => setIsOpen((current) => !current)}
        title={isLocal ? t('app.newTaskRunModeLocal') : t('app.newTaskRunModeCloud')}
      >
        {isLocal
          ? <Monitor size={15} className="shrink-0 text-gray-300" />
          : <Cloud size={15} className="shrink-0 text-gray-300" />}
        <span className="font-medium">
          {isLocal ? t('app.newTaskRunModeLocal') : t('app.newTaskRunModeCloud')}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && position ? createPortal((
        <section
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('app.newTaskRunMode')}
          className="fixed z-[100] overflow-hidden rounded-lg border border-white/[0.1] bg-[#292929] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-1 duration-150"
          data-new-task-run-mode-menu="true"
          style={position}
        >
          <div className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-gray-500">
            {t('app.newTaskRunMode')}
          </div>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isLocal}
            disabled={!localExecutionAvailable}
            className="flex min-h-14 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => selectExecutionTarget('LOCAL')}
          >
            <Monitor size={17} className="shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t('app.newTaskRunModeLocal')}</span>
              <span className="block text-xs text-gray-500">
                {localExecutionAvailable
                  ? t('app.newTaskRunModeLocalDescription')
                  : t('app.newTaskRunModeLocalUnavailable')}
              </span>
            </span>
            {isLocal ? <Check size={16} className="shrink-0" /> : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!isLocal}
            disabled={!cloudExecutionAvailable}
            className="flex min-h-14 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => selectExecutionTarget('CLOUD')}
          >
            <Cloud size={17} className="shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t('app.newTaskRunModeCloud')}</span>
              <span className="block text-xs text-gray-500">
                {cloudExecutionAvailable
                  ? t('app.newTaskRunModeCloudDescription')
                  : t('app.newTaskRunModeCloudUnavailable')}
              </span>
            </span>
            {!isLocal ? <Check size={16} className="shrink-0" /> : null}
          </button>
        </section>
      ), document.body) : null}
    </>
  );
}
