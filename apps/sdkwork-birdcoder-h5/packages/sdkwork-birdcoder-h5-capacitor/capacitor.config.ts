export interface BirdCoderH5CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
  };
  plugins?: Record<string, Record<string, unknown>>;
}

export interface BirdCoderH5CapacitorConfigOptions {
  webDir?: string;
  appId?: string;
  appName?: string;
}

export function createBirdCoderH5CapacitorConfig(
  options: BirdCoderH5CapacitorConfigOptions = {},
): BirdCoderH5CapacitorConfig {
  return {
    appId: options.appId ?? 'com.sdkwork.birdcoder.h5',
    appName: options.appName ?? 'SDKWork BirdCoder',
    webDir: options.webDir ?? 'dist',
    server: {
      androidScheme: 'https',
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        backgroundColor: '#1a1a2e',
        showSpinner: false,
      },
      Preferences: {
        group: 'sdkwork.birdcoder.h5.secure',
      },
    },
  };
}

const config = createBirdCoderH5CapacitorConfig();

export default config;
