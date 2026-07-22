import { useId } from 'react';
import { RefreshCw } from 'lucide-react';
import './StartupScreen.css';

export type StartupStage = 'runtime' | 'session' | 'workspace';

export interface StartupScreenProps {
  description: string;
  errorMessage?: string;
  onRetry?: () => void;
  progress: number;
  retryLabel?: string;
  stage: StartupStage;
  stageLabels: Record<StartupStage, string>;
  startupFailedLabel?: string;
  title: string;
}

export function StartupScreen({
  description,
  errorMessage,
  onRetry,
  progress,
  retryLabel,
  stage,
  stageLabels,
  startupFailedLabel,
  title,
}: StartupScreenProps) {
  const descriptionId = useId();
  const isFailed = Boolean(errorMessage);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const statusLabel = isFailed
    ? startupFailedLabel ?? title
    : stageLabels[stage];

  return (
    <main
      className={isFailed ? 'sdkwork-startup-screen is-failed' : 'sdkwork-startup-screen'}
      data-birdcoder-boot-shell
      aria-busy={!isFailed}
    >
      <div className="sdkwork-startup-shell">
        <header className="sdkwork-startup-brand" aria-label={title}>
          <span className="sdkwork-startup-mark" aria-hidden="true">B</span>
          <span className="sdkwork-startup-brand-copy">
            <span className="sdkwork-startup-brand-vendor">SDKWork</span>
            <span className="sdkwork-startup-brand-product">BirdCoder</span>
          </span>
        </header>

        <section
          className="sdkwork-startup-content"
          aria-live={isFailed ? 'assertive' : 'polite'}
          role={isFailed ? 'alert' : 'status'}
        >
          <div className="sdkwork-startup-state-row" aria-hidden="true">
            <span className="sdkwork-startup-status-mark" aria-hidden="true">
              <span className="sdkwork-startup-status-dot" />
            </span>
          </div>
          <h1>{title}</h1>
          <p className="sdkwork-startup-description" id={descriptionId}>
            {isFailed ? errorMessage : description}
          </p>

          <div
            className="sdkwork-startup-progress"
            role="progressbar"
            aria-describedby={descriptionId}
            aria-label={statusLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={clampedProgress}
            aria-valuetext={`${statusLabel}: ${clampedProgress}%`}
          >
            <div className="sdkwork-startup-progress-track">
              <span style={{ width: `${clampedProgress}%` }} />
            </div>
            <div className="sdkwork-startup-progress-meta" aria-hidden="true">
              <span className="sdkwork-startup-progress-stage">{statusLabel}</span>
              <span className="sdkwork-startup-progress-value">{clampedProgress}%</span>
            </div>
          </div>

          {isFailed && onRetry && retryLabel ? (
            <button className="sdkwork-startup-retry" type="button" onClick={onRetry}>
              <RefreshCw aria-hidden="true" size={15} strokeWidth={2} />
              {retryLabel}
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
