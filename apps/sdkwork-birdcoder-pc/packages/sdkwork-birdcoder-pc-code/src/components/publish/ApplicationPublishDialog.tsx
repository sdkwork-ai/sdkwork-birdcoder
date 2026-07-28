import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackageSearch,
  Rocket,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  ApplicationPublishDiscovery,
  ApplicationPublishEvidence,
  ApplicationPublishPreflight,
  ApplicationPublishProgress as PublishProgress,
  ApplicationPublishTarget,
  PublishableApplication,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useTranslation } from 'react-i18next';
import { ApplicationPublishAppList } from './ApplicationPublishAppList.tsx';
import { ApplicationPublishProgress } from './ApplicationPublishProgress.tsx';
import { ApplicationPublishTargetPanel } from './ApplicationPublishTargetPanel.tsx';
import {
  getApplicationPublishErrorTranslationKey,
  selectInitialPublishApplication,
  shouldDeployAfterReleaseByDefault,
  supportsAutomaticDeployment,
} from './applicationPublishPresentation.ts';

interface ApplicationPublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
}

type DialogPhase =
  | 'discovering'
  | 'discovery_error'
  | 'publish_error'
  | 'publishing'
  | 'ready'
  | 'success';

const FOCUSABLE_ELEMENT_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function errorMessage(
  error: unknown,
  fallback: string,
  translate: (key: string) => string,
): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string') {
      const translationKey = getApplicationPublishErrorTranslationKey(code);
      if (translationKey) {
        return translate(translationKey);
      }
    }
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function initialTarget(application: PublishableApplication | undefined): ApplicationPublishTarget | undefined {
  return application?.targets.find((target) => target.readiness === 'ready')
    ?? application?.targets[0];
}

function EvidenceRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-white/[0.06] py-2.5 text-xs last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-slate-200" title={value}>{value}</dd>
    </div>
  );
}

export function ApplicationPublishDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
}: ApplicationPublishDialogProps) {
  const { t } = useTranslation();
  const { applicationPublishService } = useIDEServices();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const discoveryRequestRef = useRef(0);
  const preflightRequestRef = useRef(0);
  const publishRequestRef = useRef(0);
  const [phase, setPhase] = useState<DialogPhase>('discovering');
  const [discovery, setDiscovery] = useState<ApplicationPublishDiscovery>();
  const [selectedRelativePath, setSelectedRelativePath] = useState<string>();
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [preflight, setPreflight] = useState<ApplicationPublishPreflight>();
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [progress, setProgress] = useState<PublishProgress[]>([]);
  const [evidence, setEvidence] = useState<ApplicationPublishEvidence>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState('0.1.0');
  const [environment, setEnvironment] = useState('production');
  const [deployAfterRelease, setDeployAfterRelease] = useState(false);

  const selectedApplication = useMemo(
    () => discovery?.applications.find((application) => application.relativePath === selectedRelativePath),
    [discovery?.applications, selectedRelativePath],
  );
  const selectedTarget = useMemo(
    () => selectedApplication?.targets.find((target) => target.id === selectedTargetId),
    [selectedApplication, selectedTargetId],
  );
  const effectiveDeployAfterRelease = Boolean(
    deployAfterRelease
    && selectedApplication
    && supportsAutomaticDeployment(selectedApplication, selectedTarget),
  );

  const discover = useCallback(async () => {
    const requestId = ++discoveryRequestRef.current;
    const normalizedProjectId = projectId?.trim();
    preflightRequestRef.current += 1;
    publishRequestRef.current += 1;
    setError(undefined);
    setEvidence(undefined);
    setPreflight(undefined);
    setIsPreflighting(false);
    setProgress([]);
    setPhase('discovering');
    if (!normalizedProjectId) {
      setError(t('code.publish.noProject'));
      setPhase('discovery_error');
      return;
    }
    try {
      const result = await applicationPublishService.discoverApplications(normalizedProjectId);
      if (requestId !== discoveryRequestRef.current) {
        return;
      }
      const application = selectInitialPublishApplication(result.applications);
      const target = initialTarget(application);
      setDiscovery(result);
      setSelectedRelativePath(application?.relativePath);
      setSelectedTargetId(target?.id);
      setDeployAfterRelease(
        application ? shouldDeployAfterReleaseByDefault(application, target) : false,
      );
      setPhase('ready');
    } catch (cause) {
      if (requestId !== discoveryRequestRef.current) {
        return;
      }
      setError(errorMessage(cause, t('code.publish.desktopRequired'), t));
      setPhase('discovery_error');
    }
  }, [applicationPublishService, projectId, t]);

  useEffect(() => {
    if (!isOpen) {
      discoveryRequestRef.current += 1;
      preflightRequestRef.current += 1;
      publishRequestRef.current += 1;
      return;
    }
    void discover();
  }, [discover, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'publishing') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, phase]);

  const selectApplication = useCallback((application: PublishableApplication) => {
    preflightRequestRef.current += 1;
    const target = initialTarget(application);
    setSelectedRelativePath(application.relativePath);
    setSelectedTargetId(target?.id);
    setDeployAfterRelease(shouldDeployAfterReleaseByDefault(application, target));
    setPreflight(undefined);
    setIsPreflighting(false);
    setError(undefined);
  }, []);

  const selectTarget = useCallback((targetId: string) => {
    preflightRequestRef.current += 1;
    const target = selectedApplication?.targets.find((item) => item.id === targetId);
    setSelectedTargetId(targetId);
    setDeployAfterRelease(
      selectedApplication
        ? shouldDeployAfterReleaseByDefault(selectedApplication, target)
        : false,
    );
    setPreflight(undefined);
    setIsPreflighting(false);
    setError(undefined);
  }, [selectedApplication]);

  const runPreflight = useCallback(async () => {
    if (!projectId?.trim() || !selectedApplication || !selectedTarget) {
      return;
    }
    const requestId = ++preflightRequestRef.current;
    setIsPreflighting(true);
    setError(undefined);
    try {
      const result = await applicationPublishService.preflightApplication({
        appRelativePath: selectedApplication.relativePath,
        projectId: projectId.trim(),
        targetId: selectedTarget.id,
      });
      if (requestId === preflightRequestRef.current) {
        setPreflight(result);
      }
    } catch (cause) {
      if (requestId === preflightRequestRef.current) {
        setPreflight(undefined);
        setError(errorMessage(cause, t('code.publish.preflightFailed'), t));
      }
    } finally {
      if (requestId === preflightRequestRef.current) {
        setIsPreflighting(false);
      }
    }
  }, [applicationPublishService, projectId, selectedApplication, selectedTarget, t]);

  const publish = useCallback(async () => {
    if (!preflight) {
      return;
    }
    const requestId = ++publishRequestRef.current;
    setError(undefined);
    setEvidence(undefined);
    setProgress([]);
    setPhase('publishing');
    try {
      const result = await applicationPublishService.publishApplication(
        {
          deployAfterRelease: effectiveDeployAfterRelease,
          environment,
          planId: preflight.planId,
          version: version.trim(),
        },
        (update) => {
          if (requestId !== publishRequestRef.current) {
            return;
          }
          setProgress((current) => current.at(-1)?.stage === update.stage
            ? [...current.slice(0, -1), update]
            : [...current, update]);
        },
      );
      if (requestId !== publishRequestRef.current) {
        return;
      }
      setEvidence(result);
      setPhase('success');
    } catch (cause) {
      if (requestId !== publishRequestRef.current) {
        return;
      }
      setError(errorMessage(cause, t('code.publish.errorTitle'), t));
      setPhase('publish_error');
    }
  }, [
    applicationPublishService,
    effectiveDeployAfterRelease,
    environment,
    preflight,
    t,
    version,
  ]);

  const recoverFromPublishError = useCallback(() => {
    publishRequestRef.current += 1;
    setPreflight(undefined);
    setProgress([]);
    setError(undefined);
    setPhase('ready');
  }, []);

  if (!isOpen) {
    return null;
  }

  const canDismiss = phase !== 'publishing';

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }
    const dialog = dialogRef.current;
    const focusableElements = Array.from(
      dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!dialog || !firstElement || !lastElement) {
      event.preventDefault();
      return;
    }
    if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
    } else if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canDismiss) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-busy={phase === 'discovering' || phase === 'publishing'}
        aria-modal="true"
        aria-labelledby="application-publish-dialog-title"
        tabIndex={-1}
        className="flex h-[min(92vh,52rem)] w-full max-w-[72rem] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#111116] shadow-2xl shadow-black/60 outline-none"
        onKeyDown={handleDialogKeyDown}
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#19191e] px-3 sm:px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-300/15 bg-blue-400/10 text-blue-200">
            <Rocket size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="application-publish-dialog-title" className="truncate text-sm font-semibold text-slate-100">
              {t('code.publish.title')}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {projectName || projectId || t('code.publish.workspace')}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            title={t('code.publish.close')}
            aria-label={t('code.publish.close')}
            disabled={!canDismiss}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <main className="min-h-0 flex-1 bg-[#101014]">
          {phase === 'discovering' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-400">
              <Loader2 size={20} className="animate-spin text-blue-300" />
              <span>{t('code.publish.loading')}</span>
            </div>
          ) : phase === 'publishing' || phase === 'publish_error' ? (
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              <div className="flex min-h-0 flex-1 items-center">
                <ApplicationPublishProgress
                  deployAfterRelease={effectiveDeployAfterRelease}
                  errorMessage={phase === 'publish_error' ? error : undefined}
                  progress={progress}
                />
              </div>
              {phase === 'publish_error' ? (
                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/[0.08] bg-[#15151a] px-4 py-3 sm:px-6">
                  <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClose}>
                    {t('code.publish.close')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={recoverFromPublishError}
                  >
                    <RotateCcw size={13} />
                    {t('code.publish.retry')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : phase === 'success' && evidence ? (
            <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center overflow-y-auto px-4 py-8 sm:px-8">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 size={19} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-100">{t('code.publish.successTitle')}</h3>
                  <p className="mt-1 truncate text-xs text-slate-500" title={evidence.fileName}>{evidence.fileName}</p>
                </div>
              </div>
              <dl className="border-y border-white/[0.08]">
                <EvidenceRow label={t('code.publish.release')} value={evidence.releaseId} />
                <EvidenceRow label={t('code.publish.deployment')} value={evidence.deploymentId} />
                <EvidenceRow label={t('code.publish.artifact')} value={evidence.artifactId} />
                <EvidenceRow label={t('code.publish.site')} value={evidence.siteId} />
                <EvidenceRow label={t('code.publish.checksum')} value={evidence.checksumSha256} />
              </dl>
              <div className="mt-6 flex justify-end">
                <Button type="button" size="sm" className="h-9" onClick={onClose}>
                  {t('code.publish.close')}
                </Button>
              </div>
            </div>
          ) : phase === 'discovery_error' ? (
            <div className="flex h-full items-center justify-center px-4 py-8">
              <div className="w-full max-w-xl rounded-md border border-rose-300/20 bg-rose-400/[0.07] px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-300" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-rose-50">{t('code.publish.errorTitle')}</h3>
                    <p className="mt-1.5 break-words text-xs leading-5 text-rose-100/75">{error}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 h-8 gap-1.5"
                      onClick={() => { void discover(); }}
                    >
                      <RotateCcw size={13} />
                      {t('code.publish.retry')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : discovery?.applications.length ? (
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] md:grid-rows-1">
              <ApplicationPublishAppList
                applications={discovery.applications}
                selectedRelativePath={selectedApplication?.relativePath}
                onSelect={selectApplication}
              />
              {selectedApplication ? (
                <ApplicationPublishTargetPanel
                  application={selectedApplication}
                  deployAfterRelease={effectiveDeployAfterRelease}
                  environment={environment}
                  errorMessage={error}
                  isPreflighting={isPreflighting}
                  preflight={preflight}
                  target={selectedTarget}
                  version={version}
                  onDeployAfterReleaseChange={setDeployAfterRelease}
                  onEnvironmentChange={setEnvironment}
                  onPreflight={() => { void runPreflight(); }}
                  onPublish={() => { void publish(); }}
                  onTargetChange={selectTarget}
                  onVersionChange={setVersion}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-500">
              <PackageSearch size={22} className="text-slate-600" />
              <span>{t('code.publish.empty')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 h-8 gap-1.5"
                onClick={() => { void discover(); }}
              >
                <RotateCcw size={13} />
                {t('code.publish.retry')}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
