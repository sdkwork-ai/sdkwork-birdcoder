import React, { useState } from 'react';
import { Monitor, Smartphone, Tablet, LayoutGrid, AppWindow, RefreshCw, ExternalLink, Maximize2, RotateCcw } from 'lucide-react';

export type PreviewPlatform = 'web' | 'miniprogram' | 'app';
export type WebDevice = 'desktop' | 'tablet' | 'mobile';
export type MiniProgramPlatform = 'wechat' | 'douyin' | 'alipay';
export type AppPlatform = 'ios' | 'android' | 'harmony';

export const DEVICE_MODELS: Record<string, { name: string, width: number, height: number, type: 'mobile' | 'tablet', os: string }> = {
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
  mpPlatform = 'wechat',
  appPlatform = 'ios',
  deviceModel = 'iphone-14-pro',
  isLandscape = false,
  refreshKey = 0
}: DevicePreviewProps) {
  // Device dimensions (width x height)
  const getDeviceDimensions = () => {
    if (platform === 'web') {
      if (webDevice === 'desktop') return { width: '100%', height: '100%', type: 'desktop' };
      if (webDevice === 'tablet') return isLandscape ? { width: '1024px', height: '768px', type: 'tablet' } : { width: '768px', height: '1024px', type: 'tablet' };
      if (webDevice === 'mobile') return isLandscape ? { width: '844px', height: '390px', type: 'mobile' } : { width: '390px', height: '844px', type: 'mobile' };
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
  const currentModel = (platform === 'miniprogram' || platform === 'app') ? DEVICE_MODELS[deviceModel] : null;

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] text-gray-300 relative">
      {/* Preview Area */}
      <div className={`flex-1 overflow-auto flex items-center justify-center relative custom-scrollbar ${isDesktop ? 'p-0' : 'p-4 bg-[#0a0a0c]'}`}>
        {/* Background Grid Pattern */}
        {!isDesktop && (
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        )}
        
        <div 
          className={`relative transition-all duration-300 ease-in-out flex flex-col ${isMobileOrTablet ? 'bg-black rounded-[2.5rem] border-[8px] border-[#2a2a2e] shadow-2xl overflow-hidden' : isDesktop ? 'w-full h-full bg-white' : 'w-full h-full bg-white rounded-lg overflow-hidden shadow-xl'}`}
          style={{ 
            width: dims.width, 
            height: dims.height,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          {/* Device Notch/Status Bar for Mobile */}
          {isMobileOrTablet && !isLandscape && (
            <div className="absolute top-0 inset-x-0 h-7 z-10 flex justify-center pointer-events-none">
              {currentModel?.os === 'android' || currentModel?.os === 'harmony' ? (
                <div className="w-4 h-4 mt-2 bg-[#2a2a2e] rounded-full shadow-inner"></div>
              ) : (
                <div className="w-32 h-6 bg-[#2a2a2e] rounded-b-3xl"></div>
              )}
            </div>
          )}

          {/* Mini Program Header */}
          {platform === 'miniprogram' && (
            <div className="h-14 bg-white border-b flex items-center justify-between px-4 pt-4 shrink-0 z-10">
              <div className="w-6"></div>
              <div className="text-black text-sm font-medium">Mini Program</div>
              <div className="flex items-center gap-2 bg-black/5 rounded-full px-2 py-1">
                <div className="w-4 h-4 rounded-full bg-black/20"></div>
                <div className="w-px h-3 bg-black/10"></div>
                <div className="w-4 h-4 rounded-full bg-black/20"></div>
              </div>
            </div>
          )}

          {/* Iframe Container */}
          <div className="flex-1 bg-white relative w-full h-full">
            <iframe
              key={refreshKey}
              src={url}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
            />
            
            {/* Overlay for "Preparing" state if url is blank */}
            {url === 'about:blank' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#18181b] text-gray-400">
                <LayoutGrid size={32} className="mb-4 opacity-20" />
                <p className="text-sm">Preview not available</p>
                <p className="text-xs opacity-50 mt-1">Start the dev server to see your app</p>
              </div>
            )}
          </div>
          
          {/* Device Home Indicator */}
          {isMobileOrTablet && !isLandscape && (
            <div className="absolute bottom-1 inset-x-0 h-1 flex justify-center pointer-events-none z-10">
              <div className="w-1/3 h-1 bg-white/50 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
