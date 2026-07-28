import {
  Boxes,
  CircleSlash2,
  Code2,
  FileCode2,
  Globe2,
  PackageCheck,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import type {
  ApplicationPublishFramework,
  PublishableApplication,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useTranslation } from 'react-i18next';
import { getApplicationFrameworkTranslationKey } from './applicationPublishPresentation.ts';

interface ApplicationPublishAppListProps {
  applications: readonly PublishableApplication[];
  onSelect: (application: PublishableApplication) => void;
  selectedRelativePath?: string;
}

function FrameworkIcon({ framework }: { framework: ApplicationPublishFramework }) {
  const iconProps = { 'aria-hidden': true, size: 16 } as const;
  switch (framework) {
    case 'flutter':
    case 'mini-program':
      return <Smartphone {...iconProps} />;
    case 'react':
    case 'vue':
      return <Code2 {...iconProps} />;
    case 'sdkwork':
      return <Boxes {...iconProps} />;
    case 'static-web':
      return <Globe2 {...iconProps} />;
    default:
      return <FileCode2 {...iconProps} />;
  }
}

export function ApplicationPublishAppList({
  applications,
  onSelect,
  selectedRelativePath,
}: ApplicationPublishAppListProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex min-h-0 flex-col border-b border-white/[0.08] bg-[#15151a] md:border-r md:border-b-0">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-3">
        <span className="min-w-0 truncate text-xs font-semibold text-slate-300">{t('code.publish.appSelection')}</span>
        <span className="text-[11px] tabular-nums text-slate-500">
          {t('code.publish.appCount', { count: applications.length })}
        </span>
      </div>
      <div className="flex min-h-0 gap-1.5 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden">
        {applications.map((application) => {
          const isSelected = application.relativePath === selectedRelativePath;
          const isReady = application.readiness === 'ready';
          const isUnsupported = application.readiness === 'unsupported';
          return (
            <button
              key={application.relativePath}
              type="button"
              aria-pressed={isSelected}
              className={`flex min-h-[4.25rem] w-[15rem] shrink-0 items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors md:w-full ${
                isSelected
                  ? 'border-blue-400/35 bg-blue-400/[0.11] text-white'
                  : 'border-transparent text-slate-300 hover:border-white/[0.08] hover:bg-white/[0.045]'
              }`}
              onClick={() => onSelect(application)}
            >
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                isSelected ? 'bg-blue-400/15 text-blue-200' : 'bg-white/[0.05] text-slate-400'
              }`}>
                <FrameworkIcon framework={application.framework} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{application.name}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="truncate">
                    {t(getApplicationFrameworkTranslationKey(application.framework))}
                  </span>
                  <span className="text-white/15">|</span>
                  <span className={`inline-flex shrink-0 items-center gap-1 ${
                    isReady
                      ? 'text-emerald-300'
                      : isUnsupported
                        ? 'text-rose-300'
                        : 'text-amber-300'
                  }`}>
                    {isReady
                      ? <PackageCheck size={11} />
                      : isUnsupported
                        ? <CircleSlash2 size={11} />
                        : <TriangleAlert size={11} />}
                    {isReady
                      ? t('code.publish.buildConfigured')
                      : isUnsupported
                        ? t('code.publish.unsupported')
                        : t('code.publish.buildNotConfigured')}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
