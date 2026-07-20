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

const STAGES: readonly StartupStage[] = ['runtime', 'session', 'workspace'];

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
  const isFailed = Boolean(errorMessage);
  const activeStageIndex = STAGES.indexOf(stage);
  const clampedProgress = Math.min(100, Math.max(0, progress));

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
            <span className="sdkwork-startup-brand-vendor">SDKWORK</span>
            <span className="sdkwork-startup-brand-product">BIRDCODER</span>
          </span>
        </header>

        <section
          className="sdkwork-startup-content"
          aria-live={isFailed ? 'assertive' : 'polite'}
        >
          <div className="sdkwork-startup-state-row">
            <span className="sdkwork-startup-status-mark" aria-hidden="true">
              <span className="sdkwork-startup-status-dot" />
            </span>
            <p className="sdkwork-startup-kicker">
              {isFailed ? startupFailedLabel : stageLabels[stage]}
            </p>
          </div>
          <h1>{title}</h1>
          <p className="sdkwork-startup-description">{isFailed ? errorMessage : description}</p>

          <div
            className="sdkwork-startup-progress"
            role="progressbar"
            aria-label={stageLabels[stage]}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={clampedProgress}
          >
            <div className="sdkwork-startup-progress-track">
              <span style={{ width: `${clampedProgress}%` }} />
            </div>
            <span className="sdkwork-startup-progress-value">{clampedProgress}%</span>
          </div>

          <ol className="sdkwork-startup-stages">
            {STAGES.map((stageName, index) => (
              <li
                className={[
                  'sdkwork-startup-stage',
                  index < activeStageIndex ? 'is-complete' : '',
                  index === activeStageIndex ? 'is-active' : '',
                ].filter(Boolean).join(' ')}
                key={stageName}
              >
                <span
                  className="sdkwork-startup-stage-indicator"
                  data-step={index + 1}
                  aria-hidden="true"
                />
                <span>{stageLabels[stageName]}</span>
              </li>
            ))}
          </ol>

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
