import { memo, useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Code2, Loader2, QrCode, Send } from 'lucide-react';
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
  const [qrCodeStatus, setQrCodeStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
    setQrCodeStatus('loading');
    setQrCodeDataUrl('');

    void QRCode.toSvgDataURL(qrValue, {
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
          setQrCodeStatus('ready');
        }
      })
      .catch(() => {
        if (!disposed) {
          setQrCodeDataUrl('');
          setQrCodeStatus('error');
        }
      });

    return () => {
      disposed = true;
    };
  }, [isActive, qrValue]);

  const sessionSummary = normalizeQrValuePart(sessionTitle) ?? normalizeQrValuePart(sessionId);
  const projectSummary = normalizeQrValuePart(projectName) ?? normalizeQrValuePart(projectId);
  const simulatorSessionTitle = sessionSummary ?? t('code.mobileProgramming.sessionFallback');
  const simulatorProjectTitle = projectSummary ?? t('code.mobileProgramming.projectFallback');
  const qrCodeFallbackTitle =
    qrCodeStatus === 'error'
      ? t('code.mobileProgramming.qrUnavailableTitle')
      : t('code.mobileProgramming.qrLoadingTitle');

  return (
    <div className={isActive ? 'flex flex-1 min-h-0 w-full overflow-auto bg-[#0e0e11]' : 'hidden'}>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 px-5 py-6 lg:grid-cols-[360px_minmax(380px,420px)] lg:justify-center lg:gap-6 lg:px-8">
        <section className="flex min-h-[760px] min-w-0 items-center justify-center">
          <div
            aria-label={t('code.mobileProgramming.simulatorLabel')}
            className="relative flex h-[720px] w-[360px] max-w-full shrink-0 items-center justify-center rounded-[46px] border border-white/15 bg-[#07080b] p-3.5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
          >
            <div className="absolute top-3 h-5 w-24 rounded-full bg-black" />
            <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#101114]">
              <div className="flex items-center justify-between border-b border-white/8 bg-[#17191f] px-4 pb-3 pt-7">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                    {t('code.mobileProgramming.simulatorStatus')}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-white">
                    {simulatorProjectTitle}
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 text-sky-200">
                  <Bot size={17} />
                </div>
              </div>

              <div className="border-b border-white/8 px-4 py-3">
                <div className="truncate text-sm font-medium text-gray-100">
                  {simulatorSessionTitle}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {t('code.mobileProgramming.simulatorSubtitle')}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
                <div className="ml-auto max-w-[86%] rounded-lg rounded-tr-sm bg-sky-500/20 px-3 py-2 text-[13px] leading-5 text-sky-50">
                  {t('code.mobileProgramming.userMessage')}
                </div>

                <div className="max-w-[92%] rounded-lg rounded-tl-sm border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] leading-5 text-gray-100">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-300">
                    <Bot size={12} />
                    BirdCoder
                  </div>
                  {t('code.mobileProgramming.assistantMessagePlan')}
                </div>

                <div className="max-w-[96%] overflow-hidden rounded-lg border border-emerald-400/15 bg-[#0b0d10]">
                  <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] text-gray-300">
                      <Code2 size={12} className="text-emerald-300" />
                      <span className="truncate">{t('code.mobileProgramming.codeFileLabel')}</span>
                    </div>
                    <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                      diff
                    </span>
                  </div>
                  <pre className="overflow-hidden px-3 py-2 font-mono text-[10.5px] leading-5 text-gray-300">
                    <code>{t('code.mobileProgramming.assistantMessageCode')}</code>
                  </pre>
                </div>

                <div className="max-w-[94%] rounded-lg rounded-tl-sm border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] leading-5 text-gray-100">
                  {t('code.mobileProgramming.assistantMessagePreview')}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-2 text-emerald-100">
                    <CheckCircle2 size={12} />
                    <span className="truncate">{t('code.mobileProgramming.changeChip')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-2 text-amber-100">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="truncate">{t('code.mobileProgramming.runChip')}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/8 bg-[#15171c] px-3 py-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-gray-500">
                    {t('code.mobileProgramming.composerPlaceholder')}
                  </span>
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"
                    aria-label={t('code.mobileProgramming.sendLabel')}
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col items-center p-2 text-center lg:sticky lg:top-6">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-100">
            <QrCode size={17} className="text-sky-300" />
            {t('code.mobileProgramming.scanPanelTitle')}
          </div>

          <div className="mt-5 flex justify-center rounded-lg bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,0.38)]">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={t('code.mobileProgramming.qrAlt')}
                className="h-64 w-64 object-contain sm:h-72 sm:w-72"
              />
            ) : (
              <div
                className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 text-slate-500 sm:h-72 sm:w-72"
                role={qrCodeStatus === 'error' ? 'alert' : 'status'}
              >
                {qrCodeStatus === 'error' ? (
                  <QrCode size={48} className="text-slate-400" />
                ) : (
                  <Loader2 size={42} className="animate-spin text-sky-500" />
                )}
                <span className="max-w-[12rem] text-center text-sm font-medium leading-5">
                  {qrCodeFallbackTitle}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <div className="text-lg font-semibold text-white">
              {t('code.mobileProgramming.scanTitle')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-sky-200">
              {t('code.mobileProgramming.scanCta')}
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-400">
              {t('code.mobileProgramming.scanDescription')}
            </p>
          </div>

          <div className="mt-5 max-w-sm text-xs leading-6 text-emerald-100/75">
            {t('code.mobileProgramming.contextHint')}
          </div>
        </aside>
      </div>
    </div>
  );
}

export const CodeMobileProgrammingPanel = memo(
  CodeMobileProgrammingPanelComponent,
  areCodeMobileProgrammingPanelPropsEqual,
);
CodeMobileProgrammingPanel.displayName = 'CodeMobileProgrammingPanel';
