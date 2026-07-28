import {
  AlertCircle,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleSlash2,
  FileArchive,
  Loader2,
  Package,
  ShieldCheck,
} from 'lucide-react';
import type {
  ApplicationPublishPreflight,
  ApplicationPublishReadiness,
  ApplicationPublishTarget,
  PublishableApplication,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { useTranslation } from 'react-i18next';
import {
  getApplicationFrameworkTranslationKey,
  getApplicationPublishPreflightCheckTranslationKey,
  isValidApplicationPublishVersion,
  supportsAutomaticDeployment,
} from './applicationPublishPresentation.ts';

interface ApplicationPublishTargetPanelProps {
  application: PublishableApplication;
  deployAfterRelease: boolean;
  environment: string;
  errorMessage?: string;
  isPreflighting: boolean;
  onDeployAfterReleaseChange: (value: boolean) => void;
  onEnvironmentChange: (value: string) => void;
  onPreflight: () => void;
  onPublish: () => void;
  onTargetChange: (targetId: string) => void;
  onVersionChange: (value: string) => void;
  preflight?: ApplicationPublishPreflight;
  target?: ApplicationPublishTarget;
  version: string;
}

function readinessTranslationKey(readiness: ApplicationPublishReadiness): string {
  return readiness === 'unsupported'
    ? 'code.publish.unsupported'
    : 'code.publish.buildNotConfigured';
}

function ReadinessNotice({
  issues,
  unsupported,
}: {
  issues: readonly string[];
  unsupported: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-md border px-4 py-4 ${
      unsupported
        ? 'border-rose-300/20 bg-rose-400/[0.07] text-rose-50'
        : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-50'
    }`}>
      <div className="flex items-start gap-3">
        {unsupported
          ? <CircleSlash2 size={18} className="mt-0.5 shrink-0 text-rose-300" />
          : <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {t(unsupported ? 'code.publish.unsupportedTitle' : 'code.publish.setupTitle')}
          </h3>
          <p className={`mt-1.5 text-xs leading-5 ${
            unsupported ? 'text-rose-100/75' : 'text-amber-100/70'
          }`}>
            {t(unsupported ? 'code.publish.unsupportedDescription' : 'code.publish.setupRequired')}
          </p>
          {issues.length > 0 ? (
            <ul className={`mt-3 space-y-1.5 border-t pt-3 text-xs ${
              unsupported
                ? 'border-rose-200/10 text-rose-100/80'
                : 'border-amber-200/10 text-amber-100/80'
            }`}>
              {issues.map((issue) => <li key={issue} className="break-words">{issue}</li>)}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ApplicationPublishTargetPanel({
  application,
  deployAfterRelease,
  environment,
  errorMessage,
  isPreflighting,
  onDeployAfterReleaseChange,
  onEnvironmentChange,
  onPreflight,
  onPublish,
  onTargetChange,
  onVersionChange,
  preflight,
  target,
  version,
}: ApplicationPublishTargetPanelProps) {
  const { t } = useTranslation();
  const failedChecks = preflight?.checks.filter((check) => check.status === 'failed') ?? [];
  const isTargetReady = application.readiness === 'ready' && target?.readiness === 'ready';
  const automaticDeploymentSupported = supportsAutomaticDeployment(application, target);
  const normalizedVersion = version.trim();
  const isVersionValid = isValidApplicationPublishVersion(normalizedVersion);
  const canPublish = Boolean(preflight && failedChecks.length === 0 && isTargetReady && isVersionValid);
  const selectedIssues = Array.from(new Set([
    ...application.setupIssues,
    ...(target?.setupIssues ?? application.targets.flatMap((item) => item.setupIssues)),
  ]));
  const effectiveReadiness = application.readiness === 'ready'
    ? target?.readiness ?? 'setup_required'
    : application.readiness;
  const isUnsupported = effectiveReadiness === 'unsupported';

  if (!target) {
    return (
      <div className="flex h-full min-h-[18rem] items-center justify-center px-5 py-8">
        <div className="w-full max-w-xl">
          <ReadinessNotice issues={selectedIssues} unsupported={isUnsupported} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-100">{application.name}</h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {t(getApplicationFrameworkTranslationKey(application.framework))}
              <span className="mx-2 text-white/15">|</span>
              {application.relativePath || '.'}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
            isTargetReady
              ? 'border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200'
              : isUnsupported
                ? 'border-rose-300/15 bg-rose-400/[0.08] text-rose-200'
                : 'border-amber-300/15 bg-amber-400/[0.08] text-amber-200'
          }`}>
            {isTargetReady
              ? <CheckCircle2 size={12} />
              : isUnsupported
                ? <CircleSlash2 size={12} />
                : <CircleAlert size={12} />}
            {isTargetReady
              ? t('code.publish.buildConfigured')
              : t(readinessTranslationKey(effectiveReadiness))}
          </span>
        </div>

        <div className="grid gap-5 py-5 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-medium text-slate-400">
            <span className="mb-2 block">{t('code.publish.target')}</span>
            <select
              className="h-9 w-full rounded-md border border-white/10 bg-[#111116] px-2.5 text-xs text-slate-200 outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20"
              value={target.id}
              disabled={isPreflighting}
              onChange={(event) => onTargetChange(event.target.value)}
            >
              {application.targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.readiness === 'ready' ? '' : ` - ${t(readinessTranslationKey(item.readiness))}`}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0 text-xs font-medium text-slate-400">
            <span className="mb-2 block">{t('code.publish.package')}</span>
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-slate-300">
              <Package size={14} className="shrink-0 text-slate-500" />
              <span className="truncate" title={target.packageId}>{target.packageId || '-'}</span>
            </div>
          </div>
          <div className="min-w-0 text-xs font-medium text-slate-400 sm:col-span-2">
            <span className="mb-2 block">{t('code.publish.artifact')}</span>
            <div className="flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-slate-300">
              <FileArchive size={14} className="shrink-0 text-slate-500" />
              <span className="min-w-0 truncate" title={preflight?.fileName ?? target.outputs.map((output) => output.fileName).join(', ')}>
                {(preflight?.fileName ?? target.outputs.map((output) => output.fileName).join(', ')) || '-'}
              </span>
            </div>
          </div>
          {preflight ? (
            <div className="min-w-0 text-xs font-medium text-slate-400 sm:col-span-2">
              <span className="mb-2 block">{t('code.publish.buildCommand')}</span>
              <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-2 font-mono text-[11px] font-normal leading-5 text-slate-300">
                {preflight.command}
              </code>
              <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] font-normal text-slate-500">
                <span className="shrink-0">{t('code.publish.workingDirectory')}</span>
                <code className="min-w-0 truncate text-slate-400" title={preflight.cwd}>
                  {preflight.cwd}
                </code>
              </div>
            </div>
          ) : null}
        </div>

        {!isTargetReady ? (
          <ReadinessNotice issues={selectedIssues} unsupported={isUnsupported} />
        ) : (
          <>
            <div className="border-y border-white/[0.07] py-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ShieldCheck size={14} className="text-blue-300" />
                {t('code.publish.checks')}
              </div>
              {errorMessage ? (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-md border border-rose-300/15 bg-rose-400/[0.07] px-2.5 py-2 text-xs leading-5 text-rose-100"
                >
                  <AlertCircle size={13} className="mt-1 shrink-0 text-rose-300" />
                  <span className="min-w-0 break-words">{errorMessage}</span>
                </div>
              ) : null}
              {preflight ? (
                <div className="space-y-1.5">
                  {preflight.checks.map((check) => {
                    const translationKey = getApplicationPublishPreflightCheckTranslationKey(
                      check.code,
                      check.status,
                    );
                    return (
                      <div
                        key={check.code}
                        className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ${
                          check.status === 'failed'
                            ? 'bg-rose-400/[0.07] text-rose-100'
                            : check.status === 'warning'
                              ? 'bg-amber-300/[0.06] text-amber-100'
                              : 'text-slate-400'
                        }`}
                      >
                        {check.status === 'passed'
                          ? <Check size={13} className="mt-0.5 shrink-0 text-emerald-300" />
                          : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                        <span className="min-w-0 break-words">
                          {translationKey ? t(translationKey) : check.message}
                        </span>
                      </div>
                    );
                  })}
                  {preflight.checks.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      <ShieldCheck size={14} />
                      {t('code.publish.preflightReady')}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs leading-5 text-slate-500">{t('code.publish.preflightPrompt')}</p>
              )}
            </div>

            <div className="grid gap-4 py-5 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-400">
                <span className="mb-2 block">{t('code.publish.version')}</span>
                <input
                  aria-describedby={isVersionValid || !normalizedVersion ? undefined : 'application-publish-version-error'}
                  aria-invalid={!isVersionValid}
                  className="h-9 w-full rounded-md border border-white/10 bg-[#111116] px-2.5 text-xs text-slate-200 outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20"
                  value={version}
                  inputMode="text"
                  placeholder="1.0.0"
                  spellCheck={false}
                  onChange={(event) => onVersionChange(event.target.value)}
                />
                {!isVersionValid && normalizedVersion ? (
                  <span id="application-publish-version-error" className="mt-1.5 block text-[11px] font-normal text-rose-300">
                    {t('code.publish.versionInvalid')}
                  </span>
                ) : null}
              </label>
              <label className="text-xs font-medium text-slate-400">
                <span className="mb-2 block">{t('code.publish.environment')}</span>
                <select
                  className="h-9 w-full rounded-md border border-white/10 bg-[#111116] px-2.5 text-xs text-slate-200 outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20"
                  value={environment}
                  onChange={(event) => onEnvironmentChange(event.target.value)}
                >
                  <option value="production">{t('code.publish.environmentProduction')}</option>
                  <option value="staging">{t('code.publish.environmentStaging')}</option>
                  <option value="development">{t('code.publish.environmentDevelopment')}</option>
                </select>
              </label>
            </div>

            <label className={`flex items-start gap-2.5 border-t border-white/[0.07] pt-4 text-xs ${
              automaticDeploymentSupported
                ? 'cursor-pointer text-slate-300'
                : 'cursor-not-allowed text-slate-500'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-blue-500"
                checked={deployAfterRelease}
                disabled={!automaticDeploymentSupported}
                onChange={(event) => onDeployAfterReleaseChange(event.target.checked)}
              />
              <span>
                <span className="block">{t('code.publish.deployAfterRelease')}</span>
                {!automaticDeploymentSupported ? (
                  <span className="mt-1 block text-[11px] leading-4 text-slate-600">
                    {t('code.publish.deploymentUnavailable')}
                  </span>
                ) : null}
              </span>
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {!preflight || failedChecks.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-28 gap-2"
                  disabled={isPreflighting}
                  onClick={onPreflight}
                >
                  {isPreflighting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {t('code.publish.preflight')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-32 gap-2 bg-blue-600 text-white hover:bg-blue-500"
                disabled={!canPublish || isPreflighting || !environment.trim()}
                onClick={onPublish}
              >
                <Package size={14} />
                {t('code.publish.buildAndPublish')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
