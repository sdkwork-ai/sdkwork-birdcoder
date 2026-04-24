import { LayoutGrid } from 'lucide-react';

export type PreviewPlatform = 'web' | 'miniprogram' | 'app';
export type WebDevice = 'desktop' | 'tablet' | 'mobile';
export type MiniProgramPlatform = 'wechat' | 'douyin' | 'alipay';
export type AppPlatform = 'ios' | 'android' | 'harmony';

export const DEVICE_MODELS: Record<string, { name: string; width: number; height: number; type: 'mobile' | 'tablet'; os: string }> = {
  'iphone-15-pro-max': { name: 'iPhone 15 Pro Max', width: 430, height: 932, type: 'mobile', os: 'ios' },
  'iphone-14-pro': { name: 'iPhone 14 Pro', width: 393, height: 852, type: 'mobile', os: 'ios' },
  'iphone-13': { name: 'iPhone 13', width: 390, height: 844, type: 'mobile', os: 'ios' },
  'iphone-se': { name: 'iPhone SE', width: 375, height: 667, type: 'mobile', os: 'ios' },
  'ipad-pro': { name: 'iPad Pro 11"', width: 834, height: 1194, type: 'tablet', os: 'ios' },
  'pixel-7': { name: 'Pixel 7', width: 412, height: 912, type: 'mobile', os: 'android' },
  'galaxy-s22': { name: 'Galaxy S22', width: 360, height: 800, type: 'mobile', os: 'android' },
  'mate-60': { name: 'Mate 60 Pro', width: 430, height: 932, type: 'mobile', os: 'harmony' },
};

interface DevicePreviewProps {
  url?: string;
  platform?: PreviewPlatform;
  webDevice?: WebDevice;
  mpPlatform?: MiniProgramPlatform;
  appPlatform?: AppPlatform;
  deviceModel?: string;
  isLandscape?: boolean;
  refreshKey?: number;
}

export function DevicePreview({
  url = 'about:blank',
  platform = 'web',
  webDevice = 'desktop',
  deviceModel = 'iphone-14-pro',
  isLandscape = false,
  refreshKey = 0,
}: DevicePreviewProps) {
  const getDeviceDimensions = () => {
    if (platform === 'web') {
      if (webDevice === 'desktop') {
        return { width: '100%', height: '100%', type: 'desktop' };
      }
      if (webDevice === 'tablet') {
        return isLandscape
          ? { width: '1024px', height: '768px', type: 'tablet' }
          : { width: '768px', height: '1024px', type: 'tablet' };
      }
      if (webDevice === 'mobile') {
        return isLandscape
          ? { width: '844px', height: '390px', type: 'mobile' }
          : { width: '390px', height: '844px', type: 'mobile' };
      }
    }

    if (platform === 'miniprogram' || platform === 'app') {
      const model = DEVICE_MODELS[deviceModel] || DEVICE_MODELS['iphone-14-pro'];
      return isLandscape
        ? { width: `${model.height}px`, height: `${model.width}px`, type: model.type }
        : { width: `${model.width}px`, height: `${model.height}px`, type: model.type };
    }

    return { width: '100%', height: '100%', type: 'desktop' };
  };

  const dims = getDeviceDimensions();
  const isMobileOrTablet = dims.type !== 'desktop';
  const isDesktop = platform === 'web' && webDevice === 'desktop';
  const currentModel = platform === 'miniprogram' || platform === 'app' ? DEVICE_MODELS[deviceModel] : null;

  return (
    <div className="relative flex h-full flex-col bg-[#0e0e11] text-gray-300">
      <div className={`relative flex flex-1 items-center justify-center overflow-auto custom-scrollbar ${isDesktop ? 'p-0' : 'bg-[#0a0a0c] p-4'}`}>
        {!isDesktop ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
        ) : null}

        <div
          className={`relative flex flex-col transition-all duration-300 ease-in-out ${
            isMobileOrTablet
              ? 'overflow-hidden rounded-[2.5rem] border-[8px] border-[#2a2a2e] bg-black shadow-2xl'
              : isDesktop
                ? 'h-full w-full bg-white'
                : 'h-full w-full overflow-hidden rounded-lg bg-white shadow-xl'
          }`}
          style={{
            width: dims.width,
            height: dims.height,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {isMobileOrTablet && !isLandscape ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-7 justify-center">
              {currentModel?.os === 'android' || currentModel?.os === 'harmony' ? (
                <div className="mt-2 h-4 w-4 rounded-full bg-[#2a2a2e] shadow-inner" />
              ) : (
                <div className="h-6 w-32 rounded-b-3xl bg-[#2a2a2e]" />
              )}
            </div>
          ) : null}

          {platform === 'miniprogram' ? (
            <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b bg-white px-4 pt-4">
              <div className="w-6" />
              <div className="text-sm font-medium text-black">Mini Program</div>
              <div className="flex items-center gap-2 rounded-full bg-black/5 px-2 py-1">
                <div className="h-4 w-4 rounded-full bg-black/20" />
                <div className="h-3 w-px bg-black/10" />
                <div className="h-4 w-4 rounded-full bg-black/20" />
              </div>
            </div>
          ) : null}

          <div className="relative h-full w-full flex-1 bg-white">
            <iframe
              key={refreshKey}
              src={url}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
            />

            {url === 'about:blank' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#18181b] text-gray-400">
                <LayoutGrid size={32} className="mb-4 opacity-20" />
                <p className="text-sm">Preview not available</p>
                <p className="mt-1 text-xs opacity-50">Start the dev server to see your app</p>
              </div>
            ) : null}
          </div>

          {isMobileOrTablet && !isLandscape ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex h-1 justify-center">
              <div className="h-1 w-1/3 rounded-full bg-white/50" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
