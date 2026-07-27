import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  RefreshCw,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { resolveSafePreviewUrl } from '@sdkwork/birdcoder-pc-ui-shell';

export interface BrowserPreviewRenderContext {
  refreshKey: string;
  title: string;
  url: string;
}

export interface BrowserPreviewAdapter {
  id: string;
  render: (context: BrowserPreviewRenderContext) => ReactNode;
}

export interface BrowserPreviewLabels {
  address: string;
  back: string;
  forward: string;
  navigate: string;
  openExternal: string;
  refresh: string;
  title: string;
}

export interface BrowserPreviewSurfaceProps {
  url: string;
  adapter?: BrowserPreviewAdapter;
  className?: string;
  labels: BrowserPreviewLabels;
  refreshKey?: number | string;
  onNavigate: (url: string) => void;
  onOpenExternal?: (url: string) => void;
}

interface BrowserNavigationState {
  entries: string[];
  index: number;
}

export function resolveBrowserPreviewAddress(value: string): string | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  if (normalizedValue.toLowerCase() === 'about:blank') {
    return 'about:blank';
  }

  const hasProtocol = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(normalizedValue);
  const isLoopback = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/iu.test(
    normalizedValue,
  );
  const candidate = hasProtocol
    ? normalizedValue
    : `${isLoopback ? 'http' : 'https'}://${normalizedValue}`;
  const safeUrl = resolveSafePreviewUrl(candidate);
  return safeUrl === 'about:blank' ? null : safeUrl;
}

export const iframeBrowserPreviewAdapter: BrowserPreviewAdapter = {
  id: 'iframe',
  render: ({ refreshKey, title, url }) => (
    <iframe
      key={refreshKey}
      className="h-full w-full border-0 bg-white"
      data-browser-preview-frame="true"
      sandbox="allow-scripts allow-forms allow-popups"
      src={url}
      title={title}
    />
  ),
};

export function BrowserPreviewSurface({
  url,
  adapter = iframeBrowserPreviewAdapter,
  className = '',
  labels,
  refreshKey = 0,
  onNavigate,
  onOpenExternal,
}: BrowserPreviewSurfaceProps) {
  const safeUrl = resolveSafePreviewUrl(url);
  const [draftUrl, setDraftUrl] = useState(safeUrl);
  const [isAddressInvalid, setIsAddressInvalid] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [navigation, setNavigation] = useState<BrowserNavigationState>(() => ({
    entries: [safeUrl],
    index: 0,
  }));

  const currentUrl = navigation.entries[navigation.index] ?? safeUrl;

  useEffect(() => {
    setNavigation((previousState) => {
      const previousUrl = previousState.entries[previousState.index];
      if (previousUrl === safeUrl) {
        return previousState;
      }
      return {
        entries: [...previousState.entries.slice(0, previousState.index + 1), safeUrl],
        index: previousState.index + 1,
      };
    });
  }, [safeUrl]);

  useEffect(() => {
    setDraftUrl(currentUrl);
    setIsAddressInvalid(false);
  }, [currentUrl]);

  const navigateTo = useCallback((nextUrl: string) => {
    if (nextUrl === currentUrl) {
      setLocalRefreshKey((previousKey) => previousKey + 1);
      return;
    }
    setNavigation((previousState) => ({
      entries: [...previousState.entries.slice(0, previousState.index + 1), nextUrl],
      index: previousState.index + 1,
    }));
    onNavigate(nextUrl);
  }, [currentUrl, onNavigate]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = resolveBrowserPreviewAddress(draftUrl);
    if (!nextUrl) {
      setIsAddressInvalid(true);
      return;
    }
    setIsAddressInvalid(false);
    navigateTo(nextUrl);
  }, [draftUrl, navigateTo]);

  const handleBack = useCallback(() => {
    const nextIndex = navigation.index - 1;
    const nextUrl = navigation.entries[nextIndex];
    if (nextIndex < 0 || !nextUrl) {
      return;
    }
    setNavigation((previousState) => ({ ...previousState, index: nextIndex }));
    onNavigate(nextUrl);
  }, [navigation, onNavigate]);

  const handleForward = useCallback(() => {
    const nextIndex = navigation.index + 1;
    const nextUrl = navigation.entries[nextIndex];
    if (nextIndex >= navigation.entries.length || !nextUrl) {
      return;
    }
    setNavigation((previousState) => ({ ...previousState, index: nextIndex }));
    onNavigate(nextUrl);
  }, [navigation, onNavigate]);

  const handleOpenExternal = useCallback(() => {
    if (onOpenExternal) {
      onOpenExternal(currentUrl);
      return;
    }
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  }, [currentUrl, onOpenExternal]);

  const renderedBrowser = useMemo(
    () => adapter.render({
      refreshKey: `${String(refreshKey)}:${localRefreshKey}`,
      title: labels.title,
      url: currentUrl,
    }),
    [adapter, currentUrl, labels.title, localRefreshKey, refreshKey],
  );

  const iconButtonClassName =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#0e0e11] ${className}`}
      data-browser-preview-adapter={adapter.id}
      data-browser-preview-surface="true"
    >
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/10 bg-[#151519] px-2">
        <button
          type="button"
          aria-label={labels.back}
          className={iconButtonClassName}
          disabled={navigation.index <= 0}
          title={labels.back}
          onClick={handleBack}
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={labels.forward}
          className={iconButtonClassName}
          disabled={navigation.index >= navigation.entries.length - 1}
          title={labels.forward}
          onClick={handleForward}
        >
          <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={labels.refresh}
          className={iconButtonClassName}
          title={labels.refresh}
          onClick={() => setLocalRefreshKey((previousKey) => previousKey + 1)}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>

        <form className="mx-1 flex min-w-0 flex-1 items-center" onSubmit={handleSubmit}>
          <div
            className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-black/30 px-2.5 transition-colors focus-within:ring-1 ${
              isAddressInvalid
                ? 'border-red-400/60 focus-within:ring-red-400/40'
                : 'border-white/10 focus-within:border-blue-400/50 focus-within:ring-blue-400/30'
            }`}
          >
            <Globe2 size={13} className="shrink-0 text-gray-500" aria-hidden="true" />
            <input
              aria-invalid={isAddressInvalid}
              aria-label={labels.address}
              autoCapitalize="none"
              autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-gray-200 outline-none placeholder:text-gray-600"
              data-browser-preview-address="true"
              inputMode="url"
              spellCheck={false}
              value={draftUrl}
              onChange={(event) => {
                setDraftUrl(event.target.value);
                setIsAddressInvalid(false);
              }}
            />
            <button
              type="submit"
              aria-label={labels.navigate}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              title={labels.navigate}
            >
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        </form>

        <button
          type="button"
          aria-label={labels.openExternal}
          className={iconButtonClassName}
          disabled={currentUrl === 'about:blank'}
          title={labels.openExternal}
          onClick={handleOpenExternal}
        >
          <ExternalLink size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 bg-white" data-browser-preview-content="true">
        {renderedBrowser}
      </div>
    </div>
  );
}
