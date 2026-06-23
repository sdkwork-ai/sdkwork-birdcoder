export interface DeepLinkHostAdapter {
  readonly available: boolean;
  readInitialAuthPath(): Promise<string | null>;
  subscribe(listener: (authPath: string) => void): () => void;
}

export function createUnavailableDeepLinkAdapter(): DeepLinkHostAdapter {
  return {
    available: false,
    async readInitialAuthPath() {
      return null;
    },
    subscribe() {
      return () => {};
    },
  };
}

export function createBrowserDeepLinkAdapter(): DeepLinkHostAdapter {
  return createUnavailableDeepLinkAdapter();
}

let boundDeepLinkAdapter: DeepLinkHostAdapter | null = null;

export function bindBirdCoderDeepLinkAdapter(adapter: DeepLinkHostAdapter): void {
  boundDeepLinkAdapter = adapter;
}

export function getBirdCoderDeepLinkAdapter(): DeepLinkHostAdapter {
  return boundDeepLinkAdapter ?? createUnavailableDeepLinkAdapter();
}

export function resetBirdCoderDeepLinkAdapter(): void {
  boundDeepLinkAdapter = null;
}
