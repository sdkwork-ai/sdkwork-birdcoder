import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  BirdCoderWorkProviderInstallationError,
  getWorkbenchWorkProviderInstallationDefinition,
  type WorkbenchWorkProviderInstallationResult,
} from '@sdkwork/birdcoder-pc-workbench/workbench/workProviderInstallation';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-pc-ui-shell';

type InstallDialogPhase = 'confirm' | 'installing' | 'success' | 'error';

export interface WorkProviderInstallDialogLabels {
  cancel: string;
  close: string;
  desktopRequired: string;
  done: string;
  install: string;
  installDescription: (provider: string, baseline: string) => string;
  installFailed: (provider: string) => string;
  installing: (provider: string) => string;
  officialSource: string;
  ready: (provider: string) => string;
  restartRequired: (provider: string) => string;
  retry: string;
  title: (provider: string) => string;
}

interface WorkProviderInstallDialogProps {
  labels: WorkProviderInstallDialogLabels;
  providerId: string;
  onClose: () => void;
  onInstall: (providerId: string) => Promise<WorkbenchWorkProviderInstallationResult>;
}

export function WorkProviderInstallDialog({
  labels,
  providerId,
  onClose,
  onInstall,
}: WorkProviderInstallDialogProps) {
  const definition = getWorkbenchWorkProviderInstallationDefinition(providerId);
  const [phase, setPhase] = useState<InstallDialogPhase>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<WorkbenchWorkProviderInstallationResult | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isBusy = phase === 'installing';

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => primaryButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [phase]);

  const closeDialog = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const runInstall = async () => {
    setPhase('installing');
    setErrorMessage('');
    setResult(null);
    try {
      const installationResult = await onInstall(providerId);
      setResult(installationResult);
      setPhase('success');
    } catch (error) {
      const message = error instanceof BirdCoderWorkProviderInstallationError
        && error.code === 'desktop-required'
        ? labels.desktopRequired
        : error instanceof Error && error.message.trim()
          ? error.message.trim()
          : labels.installFailed(definition.displayName);
      setErrorMessage(message);
      setPhase('error');
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isBusy) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const statusMessage = phase === 'installing'
    ? labels.installing(definition.displayName)
    : phase === 'success'
      ? result?.availableAfterRefresh
        ? labels.ready(definition.displayName)
        : labels.restartRequired(definition.displayName)
      : phase === 'error'
        ? errorMessage
        : labels.installDescription(definition.displayName, definition.baseline);
  const StatusIcon = phase === 'installing'
    ? Loader2
    : phase === 'success'
      ? CheckCircle2
      : phase === 'error'
        ? AlertTriangle
        : Download;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-[2px]"
      data-work-provider-install-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="birdcoder-dialog-surface w-full max-w-[460px] overflow-hidden rounded-lg border border-white/10 bg-[#242427] text-gray-100 shadow-2xl shadow-black/70"
        data-work-provider-install-dialog={providerId}
        role="dialog"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start gap-3 border-b border-white/[0.08] px-5 py-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.07]">
            <WorkbenchCodeEngineIcon engineId={providerId} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-white">
              {labels.title(definition.displayName)}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck size={13} aria-hidden="true" />
              <span>{labels.officialSource}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{new URL(definition.installerAuthority).hostname}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label={labels.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isBusy}
            title={labels.close}
            onClick={closeDialog}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div
            className={`flex gap-3 rounded-md border px-3.5 py-3 ${
              phase === 'error'
                ? 'border-red-400/20 bg-red-400/[0.07]'
                : phase === 'success'
                  ? 'border-emerald-400/20 bg-emerald-400/[0.07]'
                  : 'border-white/[0.08] bg-white/[0.035]'
            }`}
          >
            <StatusIcon
              size={18}
              aria-hidden="true"
              className={`mt-0.5 shrink-0 ${
                phase === 'installing'
                  ? 'animate-spin text-blue-300'
                  : phase === 'success'
                    ? 'text-emerald-300'
                    : phase === 'error'
                      ? 'text-red-300'
                      : 'text-gray-300'
              }`}
            />
            <p id={descriptionId} className="text-[13px] leading-5 text-gray-300">
              {statusMessage}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px]">
            <dt className="text-gray-500">Provider</dt>
            <dd className="truncate text-gray-300">{definition.displayName}</dd>
            <dt className="text-gray-500">Baseline</dt>
            <dd className="truncate font-mono text-[11px] text-gray-300" title={definition.baseline}>
              {definition.baseline}
            </dd>
          </dl>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.08] px-5 py-3.5">
          {phase === 'success' ? (
            <button
              ref={primaryButtonRef}
              type="button"
              className="h-9 rounded-md bg-white px-4 text-[13px] font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={onClose}
            >
              {labels.done}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="h-9 rounded-md px-3.5 text-[13px] font-medium text-gray-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isBusy}
                onClick={closeDialog}
              >
                {labels.cancel}
              </button>
              <button
                ref={primaryButtonRef}
                type="button"
                className="flex h-9 min-w-[92px] items-center justify-center gap-2 rounded-md bg-white px-4 text-[13px] font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-wait disabled:opacity-60"
                disabled={isBusy}
                data-work-provider-install-action="true"
                onClick={() => void runInstall()}
              >
                {isBusy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                {phase === 'error' ? labels.retry : isBusy ? labels.installing(definition.displayName) : labels.install}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
