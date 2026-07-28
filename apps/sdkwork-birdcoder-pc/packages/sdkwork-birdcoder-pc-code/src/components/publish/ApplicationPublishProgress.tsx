import { AlertCircle, Check, Circle, Loader2 } from 'lucide-react';
import type {
  ApplicationPublishProgress as PublishProgress,
  ApplicationPublishStage,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useTranslation } from 'react-i18next';
import {
  APPLICATION_PUBLISH_STAGE_ORDER,
  resolveApplicationPublishPercent,
} from './applicationPublishPresentation.ts';

interface ApplicationPublishProgressProps {
  deployAfterRelease: boolean;
  errorMessage?: string;
  progress: readonly PublishProgress[];
}

const STAGE_TRANSLATION_KEYS: Record<ApplicationPublishStage, string> = {
  building: 'code.publish.stageBuilding',
  completed: 'code.publish.stageCompleted',
  deploying: 'code.publish.stageDeploying',
  packaging: 'code.publish.stagePackaging',
  registering: 'code.publish.stageRegistering',
  releasing: 'code.publish.stageReleasing',
  uploading: 'code.publish.stageUploading',
};

export function ApplicationPublishProgress({
  deployAfterRelease,
  errorMessage,
  progress,
}: ApplicationPublishProgressProps) {
  const { t } = useTranslation();
  const visibleStages = deployAfterRelease
    ? APPLICATION_PUBLISH_STAGE_ORDER
    : APPLICATION_PUBLISH_STAGE_ORDER.filter((stage) => stage !== 'deploying');
  const activeStage = progress.at(-1)?.stage;
  const activeStageIndex = activeStage
    ? visibleStages.indexOf(activeStage)
    : -1;
  const percent = resolveApplicationPublishPercent(progress, visibleStages);

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col justify-center px-4 py-6 sm:px-8"
      aria-live="polite"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{t('code.publish.progress')}</h3>
          <p className={`mt-1 break-words text-xs ${errorMessage ? 'text-rose-300' : 'text-slate-500'}`}>
            {progress.at(-1)?.detail ?? (activeStage ? t(STAGE_TRANSLATION_KEYS[activeStage]) : '')}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-blue-200">{percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-blue-400 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-6 space-y-1">
        {visibleStages.map((stage, index) => {
          const isComplete = index < activeStageIndex || activeStage === 'completed';
          const isActive = index === activeStageIndex && activeStage !== 'completed';
          return (
            <li
              key={stage}
              className={`flex min-h-9 items-center gap-3 rounded-md px-2 text-xs ${
                isActive && errorMessage
                  ? 'bg-rose-400/[0.08] text-rose-100'
                  : isActive
                    ? 'bg-blue-400/[0.08] text-blue-100'
                    : isComplete
                      ? 'text-slate-300'
                      : 'text-slate-600'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                isComplete
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : isActive && errorMessage
                    ? 'border-rose-400/45 bg-rose-400/10 text-rose-200'
                  : isActive
                    ? 'border-blue-400/45 bg-blue-400/10 text-blue-200'
                    : 'border-white/10 text-slate-700'
              }`}>
                {isComplete
                  ? <Check size={11} />
                  : isActive && errorMessage
                    ? <AlertCircle size={11} />
                    : isActive
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Circle size={8} />}
              </span>
              <span>{t(STAGE_TRANSLATION_KEYS[stage])}</span>
            </li>
          );
        })}
      </ol>
      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-md border border-rose-300/20 bg-rose-400/[0.07] px-3 py-3 text-xs leading-5 text-rose-100"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-300" />
          <span className="min-w-0 break-words">{errorMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
