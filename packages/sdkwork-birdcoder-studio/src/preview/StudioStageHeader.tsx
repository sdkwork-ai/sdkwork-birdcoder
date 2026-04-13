import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  DEVICE_MODELS,
  type AppPlatform,
  type MiniProgramPlatform,
  type PreviewPlatform,
  type WebDevice,
} from '@sdkwork/birdcoder-ui';
import {
  AppWindow,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Globe,
  Monitor,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  Share,
  Smartphone,
  Tablet,
  Terminal,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type StageHeaderSelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

interface StageHeaderSelectProps {
  label: string;
  value: string;
  options: StageHeaderSelectOption[];
  widthClassName?: string;
  onSelect: (value: string) => void;
}

function StageHeaderSelect({
  label,
  value,
  options,
  widthClassName = 'w-[176px]',
  onSelect,
}: StageHeaderSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  if (!selectedOption) {
    return null;
  }

  return (
    <div ref={rootRef} className={`relative ${widthClassName}`}>
      <button
        type="button"
        className="group flex w-full items-center gap-2 rounded-full border border-white/10 bg-[#15161b] px-3 py-1.5 text-left text-xs text-gray-100 shadow-sm shadow-black/20 transition-colors hover:border-white/15 hover:bg-[#1a1b22]"
        onClick={() => setIsOpen((previousState) => !previousState)}
      >
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 group-hover:text-gray-400">
          {label}
        </span>
        <span className="h-3 w-px shrink-0 bg-white/10" />
        {selectedOption.icon ? <span className="shrink-0 text-gray-300">{selectedOption.icon}</span> : null}
        <span className="min-w-0 flex-1 truncate font-medium text-gray-100">{selectedOption.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180 text-gray-300' : ''}`}
        />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] p-1.5 shadow-2xl shadow-black/45 backdrop-blur-md">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-blue-500/15 text-white'
                    : 'text-gray-300 hover:bg-white/7 hover:text-white'
                }`}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
              >
                {option.icon ? <span className="shrink-0 text-gray-400">{option.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                {isSelected ? <Check size={14} className="shrink-0 text-blue-300" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface StudioStageHeaderProps {
  activeTab: 'preview' | 'simulator' | 'code';
  previewUrl: string;
  previewPlatform: PreviewPlatform;
  previewWebDevice: WebDevice;
  previewMpPlatform: MiniProgramPlatform;
  previewAppPlatform: AppPlatform;
  previewDeviceModel: string;
  previewIsLandscape: boolean;
  selectedFile?: string | null;
  viewingDiffPath?: string | null;
  isTerminalOpen: boolean;
  onTabChange: (tab: 'preview' | 'simulator' | 'code') => void;
  onPreviewPlatformChange: (platform: PreviewPlatform) => void;
  onPreviewWebDeviceChange: (device: WebDevice) => void;
  onPreviewMpPlatformChange: (platform: MiniProgramPlatform) => void;
  onPreviewAppPlatformChange: (platform: AppPlatform) => void;
  onPreviewDeviceModelChange: (deviceModel: string) => void;
  onPreviewLandscapeToggle: () => void;
  onRefreshPreview: () => void;
  onOpenPreviewInNewTab: () => void;
  onLaunchSimulator: () => void;
  onAnalyzeCode: () => void;
  onToggleTerminal: () => void;
  onOpenShare: () => void;
  onOpenPublish: () => void;
}

function resolveSimulatorTargetLabel(
  previewPlatform: PreviewPlatform,
  previewWebDevice: WebDevice,
  previewMpPlatform: MiniProgramPlatform,
  previewAppPlatform: AppPlatform,
) {
  if (previewPlatform === 'web') {
    return `web.${previewWebDevice} / browser`;
  }
  if (previewPlatform === 'miniprogram') {
    return `miniprogram.${previewMpPlatform} / simulator`;
  }
  return `app.${previewAppPlatform} / simulator`;
}

export function StudioStageHeader({
  activeTab,
  previewUrl,
  previewPlatform,
  previewWebDevice,
  previewMpPlatform,
  previewAppPlatform,
  previewDeviceModel,
  previewIsLandscape,
  selectedFile,
  viewingDiffPath,
  isTerminalOpen,
  onTabChange,
  onPreviewPlatformChange,
  onPreviewWebDeviceChange,
  onPreviewMpPlatformChange,
  onPreviewAppPlatformChange,
  onPreviewDeviceModelChange,
  onPreviewLandscapeToggle,
  onRefreshPreview,
  onOpenPreviewInNewTab,
  onLaunchSimulator,
  onAnalyzeCode,
  onToggleTerminal,
  onOpenShare,
  onOpenPublish,
}: StudioStageHeaderProps) {
  const { t } = useTranslation();
  const webDeviceOptions: StageHeaderSelectOption[] = [
    { value: 'desktop', label: t('studio.desktop'), icon: <Monitor size={14} /> },
    { value: 'tablet', label: t('studio.tablet'), icon: <Tablet size={14} /> },
    { value: 'mobile', label: t('studio.mobile'), icon: <Smartphone size={14} /> },
  ];
  const miniProgramPlatformOptions: StageHeaderSelectOption[] = [
    { value: 'wechat', label: t('studio.wechat'), icon: <AppWindow size={14} /> },
    { value: 'douyin', label: t('studio.douyin'), icon: <AppWindow size={14} /> },
    { value: 'alipay', label: t('studio.alipay'), icon: <AppWindow size={14} /> },
  ];
  const appPlatformOptions: StageHeaderSelectOption[] = [
    { value: 'ios', label: 'iOS', icon: <Smartphone size={14} /> },
    { value: 'android', label: 'Android', icon: <Smartphone size={14} /> },
    { value: 'harmony', label: 'Harmony', icon: <Smartphone size={14} /> },
  ];
  const miniProgramDeviceOptions: StageHeaderSelectOption[] = Object.entries(DEVICE_MODELS).map(([key, model]) => ({
    value: key,
    label: model.name,
    icon: <Smartphone size={14} />,
  }));
  const appDeviceOptions: StageHeaderSelectOption[] = Object.entries(DEVICE_MODELS)
    .filter(([, model]) => model.os === previewAppPlatform)
    .map(([key, model]) => ({
      value: key,
      label: model.name,
      icon: <Smartphone size={14} />,
    }));

  return (
    <div className="flex min-w-0 items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0e0e11] shrink-0">
      <div className="flex min-w-0 flex-1 items-center gap-4 text-sm">
        <div
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1 rounded-full cursor-pointer transition-colors animate-in fade-in slide-in-from-top-2 fill-mode-both ${activeTab === 'preview' ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300'}`}
          style={{ animationDelay: '0ms' }}
          onClick={() => onTabChange('preview')}
        >
          <div className={`w-2 h-2 rounded-full ${activeTab === 'preview' ? 'bg-white' : 'bg-gray-500'}`}></div>
          {t('studio.preview')}
        </div>
        <div
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1 rounded-full cursor-pointer transition-colors animate-in fade-in slide-in-from-top-2 fill-mode-both ${activeTab === 'code' ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300'}`}
          style={{ animationDelay: '25ms' }}
          onClick={() => onTabChange('code')}
        >
          <div className={`w-2 h-2 rounded-full ${activeTab === 'code' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
          {t('studio.code')}
        </div>

        {activeTab === 'preview' && (
          <div
            className="ml-2 flex min-w-0 flex-1 items-center overflow-hidden rounded-full border border-white/5 bg-black/40 px-3 py-1 max-w-[200px] animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '100ms' }}
          >
            <span className="text-xs text-gray-500 truncate">{previewUrl}</span>
          </div>
        )}
        {activeTab === 'simulator' && (
          <div
            className="ml-2 flex min-w-0 flex-1 items-center overflow-hidden rounded-full border border-white/5 bg-black/40 px-3 py-1 max-w-[260px] animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '100ms' }}
          >
            <span className="text-xs text-gray-500 truncate">
              {resolveSimulatorTargetLabel(
                previewPlatform,
                previewWebDevice,
                previewMpPlatform,
                previewAppPlatform,
              )}
            </span>
          </div>
        )}

        {activeTab === 'code' && selectedFile && !viewingDiffPath && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-gray-300 text-sm ml-2 animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '100ms' }}
          >
            <span className="text-yellow-400">{'{ }'}</span>
            <span>{selectedFile.split('/').pop()}</span>
          </div>
        )}
        {activeTab === 'code' && viewingDiffPath && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm ml-2 border border-blue-500/30 animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '100ms' }}
          >
            <Code2 size={14} />
            <span>Diff: {viewingDiffPath.split('/').pop()}</span>
          </div>
        )}
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-3 text-sm">
        {(activeTab === 'preview' || activeTab === 'simulator') && (
          <div
            className="flex items-center gap-4 mr-2 animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '150ms' }}
          >
            <div className="flex items-center rounded-full border border-white/6 bg-black/40 p-1 shadow-sm shadow-black/20">
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  previewPlatform === 'web'
                    ? 'bg-white text-[#0f1014] shadow-sm'
                    : 'text-gray-400 hover:bg-white/6 hover:text-gray-100'
                }`}
                onClick={() => onPreviewPlatformChange('web')}
              >
                <Globe size={14} className={previewPlatform === 'web' ? 'text-[#0f1014]/75' : 'text-gray-500'} />
                <span>{t('studio.web')}</span>
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  previewPlatform === 'miniprogram'
                    ? 'bg-white text-[#0f1014] shadow-sm'
                    : 'text-gray-400 hover:bg-white/6 hover:text-gray-100'
                }`}
                onClick={() => onPreviewPlatformChange('miniprogram')}
              >
                <AppWindow
                  size={14}
                  className={previewPlatform === 'miniprogram' ? 'text-[#0f1014]/75' : 'text-gray-500'}
                />
                <span>{t('studio.miniprogram')}</span>
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  previewPlatform === 'app'
                    ? 'bg-white text-[#0f1014] shadow-sm'
                    : 'text-gray-400 hover:bg-white/6 hover:text-gray-100'
                }`}
                onClick={() => onPreviewPlatformChange('app')}
              >
                <Smartphone size={14} className={previewPlatform === 'app' ? 'text-[#0f1014]/75' : 'text-gray-500'} />
                <span>{t('studio.app')}</span>
              </button>
            </div>

            <div className="w-px h-4 bg-white/10"></div>

            <div className="flex items-center gap-2">
              {previewPlatform === 'web' && (
                <StageHeaderSelect
                  label={t('studio.device')}
                  value={previewWebDevice}
                  options={webDeviceOptions}
                  widthClassName="w-[172px]"
                  onSelect={(nextValue) => onPreviewWebDeviceChange(nextValue as WebDevice)}
                />
              )}

              {previewPlatform === 'miniprogram' && (
                <div className="flex items-center gap-2">
                  <StageHeaderSelect
                    label={t('studio.platform')}
                    value={previewMpPlatform}
                    options={miniProgramPlatformOptions}
                    widthClassName="w-[182px]"
                    onSelect={(nextValue) => onPreviewMpPlatformChange(nextValue as MiniProgramPlatform)}
                  />
                  <StageHeaderSelect
                    label={t('studio.device')}
                    value={previewDeviceModel}
                    options={miniProgramDeviceOptions}
                    widthClassName="w-[220px]"
                    onSelect={onPreviewDeviceModelChange}
                  />
                </div>
              )}

              {previewPlatform === 'app' && (
                <div className="flex items-center gap-2">
                  <StageHeaderSelect
                    label={t('studio.platform')}
                    value={previewAppPlatform}
                    options={appPlatformOptions}
                    widthClassName="w-[180px]"
                    onSelect={(nextValue) => onPreviewAppPlatformChange(nextValue as AppPlatform)}
                  />
                  <StageHeaderSelect
                    label={t('studio.device')}
                    value={previewDeviceModel}
                    options={appDeviceOptions}
                    widthClassName="w-[220px]"
                    onSelect={onPreviewDeviceModelChange}
                  />
                </div>
              )}

              {previewPlatform !== 'web' || previewWebDevice !== 'desktop' ? (
                <button
                  className={`p-1.5 rounded-full transition-colors border ${previewIsLandscape ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-black/40 text-gray-400 border-white/5 hover:bg-white/5 hover:text-gray-200'}`}
                  onClick={onPreviewLandscapeToggle}
                  title={t('studio.rotateDevice')}
                >
                  <RotateCcw
                    size={14}
                    className={previewIsLandscape ? '-rotate-90 transition-transform' : 'transition-transform'}
                  />
                </button>
              ) : null}
            </div>

            <div className="w-px h-4 bg-white/10"></div>

            <div className="flex items-center gap-1">
              {activeTab === 'preview' ? (
                <>
                  <button
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    onClick={onRefreshPreview}
                    title={t('studio.refresh')}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    onClick={onOpenPreviewInNewTab}
                    title={t('studio.openInNewTab')}
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    onClick={onLaunchSimulator}
                    title={t('studio.startSimulator')}
                  >
                    <MonitorPlay size={14} />
                  </button>
                </>
              ) : (
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  onClick={onLaunchSimulator}
                  title={t('studio.startSimulator')}
                >
                  <MonitorPlay size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'code' && selectedFile && !viewingDiffPath && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-xs text-blue-400 animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '150ms' }}
            onClick={onAnalyzeCode}
          >
            <Code2 size={14} className="mr-1" /> {t('studio.analyzeCode')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 text-xs transition-colors animate-in fade-in slide-in-from-top-2 fill-mode-both ${isTerminalOpen ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}
          style={{ animationDelay: '175ms' }}
          onClick={onToggleTerminal}
        >
          <Terminal size={14} className="mr-1.5" /> {t('studio.terminal')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-xs animate-in fade-in slide-in-from-top-2 fill-mode-both"
          style={{ animationDelay: '250ms' }}
          onClick={onOpenShare}
        >
          <Share size={14} className="mr-1" /> {t('studio.share')}
        </Button>
        <Button
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs animate-in fade-in slide-in-from-top-2 fill-mode-both shadow-sm shadow-blue-900/20"
          style={{ animationDelay: '300ms' }}
          onClick={onOpenPublish}
        >
          <Upload size={14} className="mr-1" /> {t('studio.publish')}
        </Button>
      </div>
    </div>
  );
}
