import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type TokenPlanNotifyTone = 'error' | 'info' | 'success';

interface TokenPlanNotifyState {
  id: number;
  message: string;
  tone: TokenPlanNotifyTone;
}

const TONE_STYLES: Record<TokenPlanNotifyTone, string> = {
  success:
    'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200',
  error:
    'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-200',
  info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-200',
};

const TONE_ICONS: Record<TokenPlanNotifyTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: AlertCircle,
};

export function useTokenPlanNotify() {
  const [notices, setNotices] = useState<TokenPlanNotifyState[]>([]);

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const onNotify = useCallback((message: string, tone: TokenPlanNotifyTone) => {
    setNotices((current) => [...current, { id: Date.now() + current.length, message, tone }]);
  }, []);

  const NotifyOutlet = useCallback(
    function TokenPlanNotifyOutlet() {
      return (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4">
          {notices.map((notice) => {
            const Icon = TONE_ICONS[notice.tone];
            return (
              <TokenPlanNotifyToast
                Icon={Icon}
                key={notice.id}
                message={notice.message}
                onDismiss={() => dismissNotice(notice.id)}
                tone={notice.tone}
              />
            );
          })}
        </div>
      );
    },
    [dismissNotice, notices],
  );

  return { NotifyOutlet, onNotify };
}

function TokenPlanNotifyToast({
  Icon,
  message,
  onDismiss,
  tone,
}: {
  Icon: typeof CheckCircle2;
  message: string;
  onDismiss: () => void;
  tone: TokenPlanNotifyTone;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`token-plan-toast pointer-events-auto flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-xl backdrop-blur-md ${TONE_STYLES[tone]}`}
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span className="text-sm font-semibold tracking-wide">{message}</span>
      <button
        className="rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" className="h-4 w-4 opacity-70" />
      </button>
    </div>
  );
}
