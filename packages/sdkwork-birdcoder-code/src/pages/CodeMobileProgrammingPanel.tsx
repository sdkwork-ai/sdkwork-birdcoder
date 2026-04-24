import { memo, useEffect, useMemo, useState } from 'react';
import QRCode from '../shims/qrcode';
import { useTranslation } from 'react-i18next';

interface CodeMobileProgrammingPanelProps {
  isActive: boolean;
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
  sessionId?: string;
  sessionTitle?: string;
}

interface BuildCodeMobileProgrammingQrValueOptions {
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
  sessionId?: string;
  sessionTitle?: string;
}

function areCodeMobileProgrammingPanelPropsEqual(
  left: CodeMobileProgrammingPanelProps,
  right: CodeMobileProgrammingPanelProps,
) {
  if (left.isActive !== right.isActive) {
    return false;
  }

  if (!left.isActive && !right.isActive) {
    return true;
  }

  return (
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    left.projectName === right.projectName &&
    left.sessionId === right.sessionId &&
    left.sessionTitle === right.sessionTitle
  );
}

function normalizeQrValuePart(value?: string) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

export function buildCodeMobileProgrammingQrValue(
  options: BuildCodeMobileProgrammingQrValueOptions,
) {
  const params = new URLSearchParams({
    v: '1',
    source: 'desktop-code-view',
  });

  const normalizedWorkspaceId = normalizeQrValuePart(options.workspaceId);
  const normalizedProjectId = normalizeQrValuePart(options.projectId);
  const normalizedProjectName = normalizeQrValuePart(options.projectName);
  const normalizedSessionId = normalizeQrValuePart(options.sessionId);
  const normalizedSessionTitle = normalizeQrValuePart(options.sessionTitle);

  if (normalizedWorkspaceId) {
    params.set('workspaceId', normalizedWorkspaceId);
  }

  if (normalizedProjectId) {
    params.set('projectId', normalizedProjectId);
  }

  if (normalizedProjectName) {
    params.set('projectName', normalizedProjectName);
  }

  if (normalizedSessionId) {
    params.set('sessionId', normalizedSessionId);
  }

  if (normalizedSessionTitle) {
    params.set('sessionTitle', normalizedSessionTitle);
  }

  return `sdkwork://birdcoder/mobile-coding?${params.toString()}`;
}

function CodeMobileProgrammingPanelComponent({
  isActive,
  workspaceId,
  projectId,
  projectName,
  sessionId,
  sessionTitle,
}: CodeMobileProgrammingPanelProps) {
  const { t } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const qrValue = useMemo(
    () =>
      buildCodeMobileProgrammingQrValue({
        workspaceId,
        projectId,
        projectName,
        sessionId,
        sessionTitle,
      }),
    [projectId, projectName, sessionId, sessionTitle, workspaceId],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let disposed = false;

    void QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((nextQrCodeDataUrl: string) => {
        if (!disposed) {
          setQrCodeDataUrl(nextQrCodeDataUrl);
        }
      })
      .catch(() => {
        if (!disposed) {
          setQrCodeDataUrl('');
        }
      });

    return () => {
      disposed = true;
    };
  }, [isActive, qrValue]);

  const sessionSummary = normalizeQrValuePart(sessionTitle) ?? normalizeQrValuePart(sessionId);
  const projectSummary = normalizeQrValuePart(projectName) ?? normalizeQrValuePart(projectId);
  const workspaceSummary = normalizeQrValuePart(workspaceId);

  return (
    <div className={isActive ? 'flex flex-1 min-h-0 w-full overflow-auto' : 'hidden'}>
      <div className="flex w-full flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#111827_34%,#09090b_100%)] px-6 py-8 sm:px-10">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.15fr)_20rem]">
          <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                {t('code.mobileProgramming.eyebrow')}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t('code.mobileProgramming.title')}
              </h2>
              <p className="mt-4 text-sm leading-7 text-gray-300 sm:text-base">
                {t('code.mobileProgramming.description')}
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                  {t('code.mobileProgramming.workspaceLabel')}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-gray-100">
                  {workspaceSummary ?? t('code.mobileProgramming.unavailable')}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                  {t('code.mobileProgramming.projectLabel')}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-gray-100">
                  {projectSummary ?? t('code.mobileProgramming.unavailable')}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                  {t('code.mobileProgramming.sessionLabel')}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-gray-100">
                  {sessionSummary ?? t('code.mobileProgramming.unavailable')}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center rounded-[28px] border border-white/10 bg-white/95 p-5 shadow-[0_20px_50px_rgba(255,255,255,0.08)] sm:p-6">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={t('code.mobileProgramming.qrAlt')}
                  className="h-64 w-64 rounded-[24px] object-contain sm:h-72 sm:w-72"
                />
              ) : (
                <div className="h-64 w-64 animate-pulse rounded-[24px] bg-slate-200 sm:h-72 sm:w-72" />
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-4 text-sm leading-7 text-emerald-100">
              {t('code.mobileProgramming.contextHint')}
            </div>
          </section>

          <aside className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/6 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300/80">
                {t('code.mobileProgramming.stepsEyebrow')}
              </div>
              <div className="mt-3 text-xl font-semibold text-white">
                {t('code.mobileProgramming.stepsTitle')}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                  01
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {t('code.mobileProgramming.stepDownloadTitle')}
                </div>
                <div className="mt-1 text-sm leading-6 text-gray-300">
                  {t('code.mobileProgramming.stepDownloadDescription')}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                  02
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {t('code.mobileProgramming.stepScanTitle')}
                </div>
                <div className="mt-1 text-sm leading-6 text-gray-300">
                  {t('code.mobileProgramming.stepScanDescription')}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                  03
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {t('code.mobileProgramming.stepContinueTitle')}
                </div>
                <div className="mt-1 text-sm leading-6 text-gray-300">
                  {t('code.mobileProgramming.stepContinueDescription')}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 px-4 py-4 text-xs leading-6 text-gray-400">
              {t('code.mobileProgramming.installHint')}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export const CodeMobileProgrammingPanel = memo(
  CodeMobileProgrammingPanelComponent,
  areCodeMobileProgrammingPanelPropsEqual,
);
CodeMobileProgrammingPanel.displayName = 'CodeMobileProgrammingPanel';
