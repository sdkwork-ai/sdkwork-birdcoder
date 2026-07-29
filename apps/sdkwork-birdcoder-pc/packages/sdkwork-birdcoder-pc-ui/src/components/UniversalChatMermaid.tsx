import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  RotateCcw,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import mermaid from 'mermaid';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { revealChatDisclosureDetails } from './chat/messages/revealChatDisclosureDetails';
import { copyTextToClipboard } from './clipboard';

const MAX_MERMAID_SOURCE_CHARACTERS = 50_000;
const MAX_MERMAID_SVG_CACHE_ENTRIES = 24;
const MERMAID_RENDER_DELAY_MS = 120;
const MIN_MERMAID_ZOOM = 0.75;
const MAX_MERMAID_ZOOM = 2;
const MERMAID_ZOOM_STEP = 0.25;
const BLOCKED_SVG_ELEMENTS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'image',
  'animate',
  'animateMotion',
  'animateTransform',
  'set',
].join(', ');

type MermaidRenderStatus = 'error' | 'loading' | 'ready';

let mermaidInitialized = false;
let mermaidRenderSequence = 0;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
const mermaidSvgCache = new Map<string, Promise<string>>();
const resolvedMermaidSvgCache = new Map<string, string>();
const mermaidZoomCache = new Map<string, number>();

function initializeMermaid(): void {
  if (mermaidInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    darkMode: true,
    htmlLabels: false,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    flowchart: {
      useMaxWidth: true,
    },
    sequence: {
      useMaxWidth: true,
    },
    themeVariables: {
      background: '#0b0d10',
      primaryColor: '#171a20',
      primaryTextColor: '#e5e7eb',
      primaryBorderColor: '#4b5563',
      secondaryColor: '#102b28',
      secondaryTextColor: '#d1fae5',
      secondaryBorderColor: '#2f766d',
      tertiaryColor: '#1d2635',
      tertiaryTextColor: '#dbeafe',
      tertiaryBorderColor: '#475f82',
      lineColor: '#8b98aa',
      textColor: '#d1d5db',
      mainBkg: '#171a20',
      nodeBorder: '#4b5563',
      clusterBkg: '#111419',
      clusterBorder: '#343b48',
      edgeLabelBackground: '#0b0d10',
      noteBkgColor: '#24261d',
      noteBorderColor: '#6f734c',
      noteTextColor: '#f3f4f6',
      actorBkg: '#171a20',
      actorBorder: '#4b5563',
      actorTextColor: '#e5e7eb',
      signalColor: '#9ca3af',
      signalTextColor: '#e5e7eb',
      labelBoxBkgColor: '#171a20',
      labelBoxBorderColor: '#4b5563',
      labelTextColor: '#e5e7eb',
      loopTextColor: '#d1d5db',
      activationBkgColor: '#1f2937',
      activationBorderColor: '#64748b',
      fontSize: '14px',
    },
    themeCSS: `
      .nodeLabel, .edgeLabel, .labelText, .messageText { font-weight: 500; }
      .flowchart-link, .messageLine0, .messageLine1 { stroke-width: 1.5px; }
      .edgeLabel rect { fill: #0b0d10 !important; opacity: 0.94 !important; }
    `,
  });
  mermaidInitialized = true;
}

function enqueueMermaidRender<T>(render: () => Promise<T>): Promise<T> {
  const queued = mermaidRenderQueue.then(render, render);
  mermaidRenderQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function removeMermaidRenderArtifact(renderId: string): void {
  const artifact = document.getElementById(renderId);
  if (artifact?.parentElement === document.body) {
    artifact.remove();
  }
  const wrappedArtifact = document.getElementById(`d${renderId}`);
  if (wrappedArtifact?.parentElement === document.body) {
    wrappedArtifact.remove();
  }
}

function getMermaidSvg(source: string): Promise<string> {
  const cachedSvg = mermaidSvgCache.get(source);
  if (cachedSvg) {
    return cachedSvg;
  }

  initializeMermaid();
  mermaidRenderSequence += 1;
  const renderId = `birdcoder-mermaid-${mermaidRenderSequence}`;
  const svgPromise = enqueueMermaidRender(async () => {
    try {
      const renderResult = await mermaid.render(renderId, source);
      return renderResult.svg;
    } finally {
      removeMermaidRenderArtifact(renderId);
    }
  });
  void svgPromise.then(
    (svgText) => {
      if (mermaidSvgCache.get(source) === svgPromise) {
        resolvedMermaidSvgCache.set(source, svgText);
      }
    },
    () => undefined,
  );

  mermaidSvgCache.set(source, svgPromise);
  if (mermaidSvgCache.size > MAX_MERMAID_SVG_CACHE_ENTRIES) {
    const oldestSource = mermaidSvgCache.keys().next().value;
    if (typeof oldestSource === 'string') {
      mermaidSvgCache.delete(oldestSource);
      resolvedMermaidSvgCache.delete(oldestSource);
      mermaidZoomCache.delete(oldestSource);
    }
  }
  void svgPromise.catch(() => {
    if (mermaidSvgCache.get(source) === svgPromise) {
      mermaidSvgCache.delete(source);
      resolvedMermaidSvgCache.delete(source);
    }
  });

  return svgPromise;
}

function containsUnsafeCss(value: string): boolean {
  if (/@import|@font-face|javascript:|expression\s*\(/iu.test(value)) {
    return true;
  }

  return [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/giu)]
    .some((match) => !(match[2] ?? '').trim().startsWith('#'));
}

function isUnsafeSvgAttribute(name: string, value: string): boolean {
  const normalizedName = name.toLowerCase();
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedName.startsWith('on')) {
    return true;
  }
  if (normalizedName === 'style' && containsUnsafeCss(value)) {
    return true;
  }
  if (
    normalizedValue.includes('javascript:')
    || normalizedValue.includes('expression(')
  ) {
    return true;
  }
  if (
    normalizedName === 'href'
    || normalizedName === 'xlink:href'
    || normalizedName === 'src'
  ) {
    return normalizedValue.length > 0 && !normalizedValue.startsWith('#');
  }
  return false;
}

export function buildSafeMermaidSvg(svgText: string, accessibleLabel: string): SVGSVGElement {
  const parsedDocument = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsedDocument.doctype || parsedDocument.querySelector('parsererror')) {
    throw new Error('Mermaid returned invalid SVG.');
  }
  const parsedSvg = parsedDocument.documentElement;
  if (parsedSvg.localName.toLowerCase() !== 'svg') {
    throw new Error('Mermaid output did not contain an SVG root.');
  }

  parsedSvg.querySelectorAll(BLOCKED_SVG_ELEMENTS).forEach((element) => element.remove());
  parsedSvg.querySelectorAll('style').forEach((element) => {
    if (containsUnsafeCss(element.textContent ?? '')) {
      element.remove();
    }
  });
  [parsedSvg, ...parsedSvg.querySelectorAll('*')].forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (isUnsafeSvgAttribute(attribute.name, attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  const width = Number.parseFloat(parsedSvg.getAttribute('width') ?? '');
  const height = Number.parseFloat(parsedSvg.getAttribute('height') ?? '');
  if (!parsedSvg.hasAttribute('viewBox') && Number.isFinite(width) && Number.isFinite(height)) {
    parsedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  parsedSvg.removeAttribute('height');
  parsedSvg.removeAttribute('width');
  parsedSvg.setAttribute('role', 'img');
  parsedSvg.setAttribute('aria-label', accessibleLabel);
  parsedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  parsedSvg.style.display = 'block';
  parsedSvg.style.height = 'auto';
  parsedSvg.style.maxWidth = 'none';
  parsedSvg.style.width = '100%';

  return document.importNode(parsedSvg, true) as unknown as SVGSVGElement;
}

export interface UniversalChatMermaidProps {
  source: string;
}

export function UniversalChatMermaid({ source }: UniversalChatMermaidProps) {
  const { t } = useTranslation();
  const reactId = useId();
  const diagramId = `birdcoder-mermaid-figure-${reactId.replace(/[^a-z0-9_-]/giu, '')}`;
  const normalizedSource = source.replace(/\n$/u, '').trim();
  const diagramHostRef = useRef<HTMLDivElement>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [renderStatus, setRenderStatus] = useState<MermaidRenderStatus>('loading');
  const [retryVersion, setRetryVersion] = useState(0);
  const [zoom, setZoom] = useState(() => mermaidZoomCache.get(normalizedSource) ?? 1);
  const diagramLabel = t('chat.mermaidDiagram');

  const updateZoom = (nextZoom: number) => {
    mermaidZoomCache.delete(normalizedSource);
    mermaidZoomCache.set(normalizedSource, nextZoom);
    setZoom(nextZoom);
    revealChatDisclosureDetails(diagramId);
  };

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    const host = diagramHostRef.current;
    if (!host) {
      return undefined;
    }

    let cancelled = false;
    host.replaceChildren();
    setRenderStatus('loading');
    setZoom(mermaidZoomCache.get(normalizedSource) ?? 1);

    const commitSvg = (svgText: string) => {
      const safeSvg = buildSafeMermaidSvg(svgText, diagramLabel);
      host.replaceChildren(safeSvg);
      setRenderStatus('ready');
    };
    const renderSvg = () => {
      void (async () => {
        try {
          if (!normalizedSource || normalizedSource.length > MAX_MERMAID_SOURCE_CHARACTERS) {
            throw new Error('Mermaid source is empty or exceeds the supported size.');
          }
          const svgText = await getMermaidSvg(normalizedSource);
          if (cancelled) {
            return;
          }
          commitSvg(svgText);
        } catch {
          if (!cancelled) {
            mermaidSvgCache.delete(normalizedSource);
            resolvedMermaidSvgCache.delete(normalizedSource);
            host.replaceChildren();
            setRenderStatus('error');
          }
        }
      })();
    };

    const cachedSvgText = resolvedMermaidSvgCache.get(normalizedSource);
    let renderTimer: number | null = null;
    if (cachedSvgText) {
      try {
        commitSvg(cachedSvgText);
      } catch {
        mermaidSvgCache.delete(normalizedSource);
        resolvedMermaidSvgCache.delete(normalizedSource);
        setRenderStatus('error');
      }
    } else {
      renderTimer = window.setTimeout(renderSvg, MERMAID_RENDER_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (renderTimer !== null) {
        window.clearTimeout(renderTimer);
      }
      host.replaceChildren();
    };
  }, [diagramId, diagramLabel, normalizedSource, retryVersion]);

  useEffect(() => () => {
    clearCopyFeedbackTimeout();
  }, [clearCopyFeedbackTimeout]);

  const handleCopy = async () => {
    if (!await copyTextToClipboard(normalizedSource)) {
      return;
    }
    setCopied(true);
    clearCopyFeedbackTimeout();
    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copyFeedbackTimeoutRef.current = null;
    }, 2_000);
  };

  const controlClassName = 'h-7 w-7 rounded-md text-gray-500 hover:bg-white/[0.07] hover:text-gray-200 disabled:opacity-30';

  return (
    <figure
      id={diagramId}
      data-chat-mermaid={renderStatus}
      data-chat-mermaid-zoom={zoom}
      className="group/mermaid my-3 max-w-full overflow-hidden rounded-md border border-white/10 bg-[#0b0d10]"
    >
      <figcaption className="flex min-h-9 items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-2.5 py-1">
        <Workflow size={14} className="shrink-0 text-sky-300/80" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
          {diagramLabel}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={controlClassName}
            onClick={() => updateZoom(Math.max(MIN_MERMAID_ZOOM, zoom - MERMAID_ZOOM_STEP))}
            disabled={renderStatus !== 'ready' || zoom <= MIN_MERMAID_ZOOM}
            title={t('chat.mermaidZoomOut')}
            aria-label={t('chat.mermaidZoomOut')}
            data-chat-mermaid-zoom-out="true"
          >
            <ZoomOut size={13} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={controlClassName}
            onClick={() => updateZoom(1)}
            disabled={renderStatus !== 'ready' || zoom === 1}
            title={t('chat.mermaidResetZoom')}
            aria-label={t('chat.mermaidResetZoom')}
            data-chat-mermaid-reset-zoom="true"
          >
            <RotateCcw size={13} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={controlClassName}
            onClick={() => updateZoom(Math.min(MAX_MERMAID_ZOOM, zoom + MERMAID_ZOOM_STEP))}
            disabled={renderStatus !== 'ready' || zoom >= MAX_MERMAID_ZOOM}
            title={t('chat.mermaidZoomIn')}
            aria-label={t('chat.mermaidZoomIn')}
            data-chat-mermaid-zoom-in="true"
          >
            <ZoomIn size={13} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={controlClassName}
            onClick={handleCopy}
            title={t('chat.mermaidCopySource')}
            aria-label={t('chat.mermaidCopySource')}
            data-chat-mermaid-copy="true"
          >
            {copied
              ? <Check size={13} className="text-emerald-400" aria-hidden="true" />
              : <Copy size={13} aria-hidden="true" />}
          </Button>
        </div>
      </figcaption>

      <div
        data-chat-mermaid-viewport="true"
        className="max-h-[34rem] min-h-44 overflow-auto p-4 custom-scrollbar"
      >
        {renderStatus === 'loading' ? (
          <div
            className="flex min-h-36 items-center justify-center"
            role="status"
            aria-label={t('chat.mermaidRendering')}
          >
            <RefreshCw size={16} className="animate-spin text-gray-600" aria-hidden="true" />
          </div>
        ) : null}
        {renderStatus === 'error' ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            <div className="text-[13px] text-gray-400">{t('chat.mermaidRenderFailed')}</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 rounded-md px-3 text-xs text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
              onClick={() => setRetryVersion((current) => current + 1)}
              data-chat-mermaid-retry="true"
            >
              <RefreshCw size={13} aria-hidden="true" />
              {t('chat.mermaidRetry')}
            </Button>
            <details className="w-full max-w-2xl text-left">
              <summary className="cursor-pointer text-[11px] text-gray-600 hover:text-gray-400">
                {t('chat.mermaidSource')}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-3 font-mono text-[11px] text-gray-500 custom-scrollbar">
                {normalizedSource}
              </pre>
            </details>
          </div>
        ) : null}
        <div
          ref={diagramHostRef}
          data-chat-mermaid-svg-host="true"
          className={renderStatus === 'ready' ? 'min-w-0' : 'hidden'}
          style={{
            marginInline: zoom <= 1 ? 'auto' : undefined,
            width: `${zoom * 100}%`,
          }}
        />
      </div>
    </figure>
  );
}
