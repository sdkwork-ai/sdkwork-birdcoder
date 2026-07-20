interface BirdCoderTestRuntimeWindow {
  __BIRDCODER_ENV__?: Record<string, unknown>;
  location?: {
    hostname: string;
  };
}

const DEFAULT_TEST_RUNTIME_ENV = {
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: 'http://127.0.0.1:3900',
} as const;

export function installBirdCoderTestRuntimeEnv(
  overrides: Record<string, unknown> = {},
): () => void {
  const host = globalThis as typeof globalThis & {
    window?: BirdCoderTestRuntimeWindow;
  };
  const existingWindow = host.window;
  const runtimeEnv = {
    ...DEFAULT_TEST_RUNTIME_ENV,
    ...overrides,
  };

  if (existingWindow) {
    const previousRuntimeEnv = existingWindow.__BIRDCODER_ENV__;
    existingWindow.__BIRDCODER_ENV__ = {
      ...previousRuntimeEnv,
      ...runtimeEnv,
    };
    return () => {
      if (previousRuntimeEnv) {
        existingWindow.__BIRDCODER_ENV__ = previousRuntimeEnv;
      } else {
        delete existingWindow.__BIRDCODER_ENV__;
      }
    };
  }

  const previousWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __BIRDCODER_ENV__: runtimeEnv,
      location: {
        hostname: 'localhost',
      },
    } satisfies BirdCoderTestRuntimeWindow,
  });

  return () => {
    if (previousWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', previousWindowDescriptor);
    } else {
      delete host.window;
    }
  };
}
