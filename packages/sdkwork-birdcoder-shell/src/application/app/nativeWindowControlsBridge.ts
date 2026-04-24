import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

type NativeWindowControlAction = 'minimize' | 'toggleMaximize' | 'close';

type NativeWindowControlRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NativeWindowControlsBridgeConfig = {
  active: boolean;
  minimize: NativeWindowControlRect | null;
  maximize: NativeWindowControlRect | null;
  close: NativeWindowControlRect | null;
};

type NativeWindowControlsBridgeCapabilities = {
  platform: string;
  supportsNativeHitTest: boolean;
  supportsSystemHoverPreview: boolean;
  usesHostControlActions: boolean;
};

type NativeWindowControlsBridgeOptions = {
  enabled: boolean;
  isFullscreen: boolean;
  minimizeButtonRef: RefObject<HTMLElement | null>;
  maximizeButtonRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLElement | null>;
};

type TauriCoreModule = typeof import('@tauri-apps/api/core');

const WINDOW_CONTROLS_BRIDGE_COMMAND = 'desktop_configure_window_controls_bridge';
const WINDOW_CONTROLS_BRIDGE_CAPABILITIES_COMMAND =
  'desktop_window_controls_bridge_capabilities';
const WINDOW_CONTROL_ACTION_COMMAND = 'desktop_perform_window_control_action';
const DEFAULT_BRIDGE_CAPABILITIES: NativeWindowControlsBridgeCapabilities = {
  platform: 'browser',
  supportsNativeHitTest: false,
  supportsSystemHoverPreview: false,
  usesHostControlActions: false,
};

let tauriCoreModulePromise: Promise<TauriCoreModule> | null = null;
let bridgeCapabilitiesPromise: Promise<NativeWindowControlsBridgeCapabilities> | null = null;

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function buildPhysicalRect(
  element: HTMLElement | null,
  devicePixelRatio: number,
): NativeWindowControlRect | null {
  if (!element) {
    return null;
  }

  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    x: Math.round(bounds.left * devicePixelRatio),
    y: Math.round(bounds.top * devicePixelRatio),
    width: Math.round(bounds.width * devicePixelRatio),
    height: Math.round(bounds.height * devicePixelRatio),
  };
}

function buildBridgeConfig(
  options: NativeWindowControlsBridgeOptions,
): NativeWindowControlsBridgeConfig {
  if (!options.enabled || options.isFullscreen || typeof window === 'undefined') {
    return {
      active: false,
      minimize: null,
      maximize: null,
      close: null,
    };
  }

  const devicePixelRatio = getDevicePixelRatio();
  const minimize = buildPhysicalRect(options.minimizeButtonRef.current, devicePixelRatio);
  const maximize = buildPhysicalRect(options.maximizeButtonRef.current, devicePixelRatio);
  const close = buildPhysicalRect(options.closeButtonRef.current, devicePixelRatio);

  if (!minimize || !maximize || !close) {
    return {
      active: false,
      minimize: null,
      maximize: null,
      close: null,
    };
  }

  return {
    active: true,
    minimize,
    maximize,
    close,
  };
}

async function loadTauriCoreModule(): Promise<TauriCoreModule | null> {
  if (tauriCoreModulePromise === null) {
    tauriCoreModulePromise = import('@tauri-apps/api/core');
  }

  try {
    const tauriCoreModule = await tauriCoreModulePromise;
    return tauriCoreModule.isTauri() ? tauriCoreModule : null;
  } catch (error) {
    tauriCoreModulePromise = null;
    console.warn('Failed to load Tauri core bridge module', error);
    return null;
  }
}

async function configureNativeWindowControlsBridge(
  config: NativeWindowControlsBridgeConfig,
): Promise<boolean> {
  const tauriCoreModule = await loadTauriCoreModule();
  if (!tauriCoreModule) {
    return false;
  }

  await tauriCoreModule.invoke(WINDOW_CONTROLS_BRIDGE_COMMAND, { config });
  return true;
}

async function disableNativeWindowControlsBridge(): Promise<void> {
  try {
    await configureNativeWindowControlsBridge({
      active: false,
      minimize: null,
      maximize: null,
      close: null,
    });
  } catch (error) {
    console.warn('Failed to disable native window controls bridge', error);
  }
}

async function readNativeWindowControlsBridgeCapabilities(): Promise<NativeWindowControlsBridgeCapabilities> {
  if (bridgeCapabilitiesPromise) {
    return bridgeCapabilitiesPromise;
  }

  bridgeCapabilitiesPromise = (async () => {
    const tauriCoreModule = await loadTauriCoreModule();
    if (!tauriCoreModule) {
      return DEFAULT_BRIDGE_CAPABILITIES;
    }

    return tauriCoreModule.invoke<NativeWindowControlsBridgeCapabilities>(
      WINDOW_CONTROLS_BRIDGE_CAPABILITIES_COMMAND,
    );
  })().catch((error) => {
    bridgeCapabilitiesPromise = null;
    throw error;
  });

  return bridgeCapabilitiesPromise;
}

export async function performNativeWindowControlAction(
  action: NativeWindowControlAction,
): Promise<boolean> {
  const bridgeCapabilities = await readNativeWindowControlsBridgeCapabilities();
  if (!bridgeCapabilities.usesHostControlActions) {
    return false;
  }

  const tauriCoreModule = await loadTauriCoreModule();
  if (!tauriCoreModule) {
    return false;
  }

  await tauriCoreModule.invoke(WINDOW_CONTROL_ACTION_COMMAND, { action });
  return true;
}

export function useNativeWindowControlsBridge(
  options: NativeWindowControlsBridgeOptions,
): NativeWindowControlsBridgeCapabilities {
  const minimizeButtonElement = options.minimizeButtonRef.current;
  const maximizeButtonElement = options.maximizeButtonRef.current;
  const closeButtonElement = options.closeButtonRef.current;
  const lastSerializedConfigRef = useRef<string>('');
  const scheduleBridgeConfigSyncRef = useRef<(() => void) | null>(null);
  const bridgeOptionsRef = useRef(options);
  bridgeOptionsRef.current = options;
  const [bridgeCapabilities, setBridgeCapabilities] = useState<NativeWindowControlsBridgeCapabilities>(
    DEFAULT_BRIDGE_CAPABILITIES,
  );
  const bridgeCapabilitiesRef = useRef(DEFAULT_BRIDGE_CAPABILITIES);
  bridgeCapabilitiesRef.current = bridgeCapabilities;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextCapabilities = await readNativeWindowControlsBridgeCapabilities();
        if (!cancelled) {
          setBridgeCapabilities(nextCapabilities);
        }
      } catch (error) {
        if (!cancelled) {
          setBridgeCapabilities(DEFAULT_BRIDGE_CAPABILITIES);
          console.warn('Failed to read native window controls bridge capabilities', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!bridgeCapabilities.supportsNativeHitTest) {
      scheduleBridgeConfigSyncRef.current = null;
      lastSerializedConfigRef.current = '';
      return;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const syncBridgeConfig = async () => {
      animationFrameId = 0;
      if (!bridgeCapabilitiesRef.current.supportsNativeHitTest) {
        lastSerializedConfigRef.current = '';
        return;
      }

      const config = buildBridgeConfig(bridgeOptionsRef.current);
      const serializedConfig = JSON.stringify(config);
      if (serializedConfig === lastSerializedConfigRef.current) {
        return;
      }

      try {
        const bridgeConfigured = await configureNativeWindowControlsBridge(config);
        if (!bridgeConfigured) {
          lastSerializedConfigRef.current = '';
          return;
        }

        lastSerializedConfigRef.current = serializedConfig;
      } catch (error) {
        lastSerializedConfigRef.current = '';
        console.warn('Failed to configure native window controls bridge', error);
      }
    };

    const scheduleBridgeConfigSync = () => {
      if (cancelled || animationFrameId !== 0) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        void syncBridgeConfig();
      });
    };

    scheduleBridgeConfigSyncRef.current = scheduleBridgeConfigSync;
    scheduleBridgeConfigSync();
    window.addEventListener('resize', scheduleBridgeConfigSync);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleBridgeConfigSync();
      });

      if (minimizeButtonElement) {
        resizeObserver.observe(minimizeButtonElement);
      }
      if (maximizeButtonElement) {
        resizeObserver.observe(maximizeButtonElement);
      }
      if (closeButtonElement) {
        resizeObserver.observe(closeButtonElement);
      }
    }

    return () => {
      cancelled = true;
      scheduleBridgeConfigSyncRef.current = null;
      window.removeEventListener('resize', scheduleBridgeConfigSync);
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      lastSerializedConfigRef.current = '';

      void disableNativeWindowControlsBridge();
    };
  }, [
    bridgeCapabilities.supportsNativeHitTest,
    closeButtonElement,
    maximizeButtonElement,
    minimizeButtonElement,
  ]);

  useLayoutEffect(() => {
    scheduleBridgeConfigSyncRef.current?.();
  }, [
    bridgeCapabilities.supportsNativeHitTest,
    closeButtonElement,
    options.enabled,
    options.isFullscreen,
    maximizeButtonElement,
    minimizeButtonElement,
  ]);

  return bridgeCapabilities;
}
