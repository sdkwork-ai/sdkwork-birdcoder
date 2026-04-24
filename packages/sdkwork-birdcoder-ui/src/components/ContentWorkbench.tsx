import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { cn } from '@sdkwork/birdcoder-ui-shell';
import { ContentEditor, type ContentEditorProps } from './ContentEditor';
import type { ContentPreviewerProps } from './ContentPreviewer';
import {
  type ContentPreviewKind,
  type ResolvedContentPreviewDescriptor,
  type ContentWorkbenchMode,
} from './contentPreview';
import { DeferredContentPreviewer } from './DeferredContentPreviewer';

export interface ContentWorkbenchLabels {
  edit?: string;
  preview?: string;
  split?: string;
}

export interface ContentWorkbenchProps {
  className?: string;
  defaultMode?: ContentWorkbenchMode;
  EditorComponent?: ComponentType<ContentEditorProps>;
  editorProps?: Omit<
    ContentEditorProps,
    'language' | 'onChange' | 'readOnly' | 'value'
  >;
  enablePreview?: boolean;
  enableSplitMode?: boolean;
  footer?: ReactNode;
  headerEndSlot?: ReactNode;
  headerStartSlot?: ReactNode;
  labels?: ContentWorkbenchLabels;
  language: string;
  mode?: ContentWorkbenchMode;
  onChange?: (value: string | undefined) => void;
  onModeChange?: (mode: ContentWorkbenchMode) => void;
  path?: string;
  previewDescriptor?: ResolvedContentPreviewDescriptor;
  previewKind?: ContentPreviewKind;
  previewerProps?: Omit<
    ContentPreviewerProps,
    'descriptor' | 'kind' | 'language' | 'path' | 'value'
  >;
  readOnly?: boolean;
  responsiveSplitBreakpoint?: number;
  showHeader?: boolean;
  value: string;
}

const DEFAULT_LABELS: Required<ContentWorkbenchLabels> = {
  edit: 'Edit',
  preview: 'Preview',
  split: 'Split',
};

const CONTENT_PREVIEW_KIND_LABELS: Record<
  Exclude<ContentPreviewKind, 'auto'>,
  string
> = {
  html: 'HTML',
  markdown: 'Markdown',
  svg: 'SVG',
  text: 'Text',
};

export function ContentWorkbench({
  className,
  defaultMode = 'edit',
  EditorComponent = ContentEditor,
  editorProps,
  enablePreview = true,
  enableSplitMode = true,
  footer,
  headerEndSlot,
  headerStartSlot,
  labels,
  language,
  mode,
  onChange,
  onModeChange,
  path,
  previewDescriptor,
  previewKind = 'auto',
  previewerProps,
  readOnly = false,
  responsiveSplitBreakpoint = 960,
  showHeader = true,
  value,
}: ContentWorkbenchProps) {
  const mergedLabels = {
    ...DEFAULT_LABELS,
    ...labels,
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalMode, setInternalMode] = useState<ContentWorkbenchMode>(defaultMode);
  const [isCompactSplitLayout, setIsCompactSplitLayout] = useState(false);
  const [resolvedPreviewKind, setResolvedPreviewKind] = useState<
    ResolvedContentPreviewDescriptor['kind'] | null
  >(() => previewDescriptor?.kind ?? null);

  useEffect(() => {
    setResolvedPreviewKind(previewDescriptor?.kind ?? null);
  }, [path, previewDescriptor?.kind]);

  const previewBadgeLabel = useMemo(() => {
    const explicitDisplayLabel = previewDescriptor?.displayLabel?.trim();
    if (explicitDisplayLabel) {
      return `${explicitDisplayLabel} Preview`;
    }

    if (previewKind !== 'auto') {
      return `${CONTENT_PREVIEW_KIND_LABELS[previewKind]} Preview`;
    }

    if (resolvedPreviewKind) {
      return `${CONTENT_PREVIEW_KIND_LABELS[resolvedPreviewKind]} Preview`;
    }

    return 'Preview';
  }, [previewDescriptor?.displayLabel, previewKind, resolvedPreviewKind]);

  const fileName = path?.split(/[\\/]/u).at(-1)?.trim() || 'Untitled';
  const previewerNode = useMemo(
    () => (
      <DeferredContentPreviewer
        {...previewerProps}
        descriptor={previewDescriptor}
        kind={previewKind}
        language={language}
        onResolvedKindChange={setResolvedPreviewKind}
        path={path}
        value={value}
      />
    ),
    [language, path, previewDescriptor, previewKind, previewerProps, value],
  );
  const availableModes = useMemo(() => {
    const nextModes: ContentWorkbenchMode[] = ['edit'];

    if (enablePreview) {
      nextModes.push('preview');
    }

    if (enablePreview && enableSplitMode) {
      nextModes.push('split');
    }

    return nextModes;
  }, [enablePreview, enableSplitMode]);
  const currentMode = availableModes.includes(mode ?? internalMode)
    ? (mode ?? internalMode)
    : (availableModes[0] ?? 'edit');

  useEffect(() => {
    if (mode !== undefined || availableModes.includes(internalMode)) {
      return;
    }

    setInternalMode(availableModes[0] ?? 'edit');
  }, [availableModes, internalMode, mode]);

  useEffect(() => {
    if (mode !== undefined) {
      return;
    }

    setInternalMode((previousMode) =>
      previousMode === defaultMode ? previousMode : defaultMode,
    );
  }, [defaultMode, mode, path]);

  useEffect(() => {
    if (currentMode !== 'split') {
      setIsCompactSplitLayout((previousMode) =>
        previousMode ? false : previousMode,
      );
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateLayoutMode = () => {
      const nextIsCompactSplitLayout = container.clientWidth < responsiveSplitBreakpoint;
      setIsCompactSplitLayout((previousMode) =>
        previousMode === nextIsCompactSplitLayout ? previousMode : nextIsCompactSplitLayout,
      );
    };

    updateLayoutMode();

    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }

    let animationFrameId = 0;
    const observer = new ResizeObserver(() => {
      if (animationFrameId !== 0) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        updateLayoutMode();
      });
    });
    observer.observe(container);

    return () => {
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
      observer.disconnect();
    };
  }, [currentMode, responsiveSplitBreakpoint]);

  const handleModeChange = (nextMode: ContentWorkbenchMode) => {
    if (!availableModes.includes(nextMode) || nextMode === currentMode) {
      return;
    }

    if (mode === undefined) {
      setInternalMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  const editorNode = (
    <EditorComponent
      {...editorProps}
      language={language}
      onChange={onChange}
      readOnly={readOnly}
      value={value}
    />
  );

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full min-h-0 flex-col bg-[#0e0e11]', className)}
    >
      {showHeader ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111319] px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-100">{fileName}</div>
              <div className="truncate text-xs text-gray-500">{path || language}</div>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-300">
              {previewBadgeLabel}
            </span>
            {headerStartSlot}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
              {availableModes.map((candidateMode) => {
                const isActive = candidateMode === currentMode;
                return (
                  <button
                    key={candidateMode}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-[#0e0e11]'
                        : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
                    }`}
                    onClick={() => handleModeChange(candidateMode)}
                    type="button"
                  >
                    {mergedLabels[candidateMode]}
                  </button>
                );
              })}
            </div>
            {headerEndSlot}
          </div>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden">
        {currentMode === 'edit' ? (
          editorNode
        ) : currentMode === 'preview' ? (
          previewerNode
        ) : (
          <div
            className={`flex h-full min-h-0 overflow-hidden ${
              isCompactSplitLayout ? 'flex-col' : 'flex-row'
            }`}
          >
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{editorNode}</div>
            <div
              className={`shrink-0 bg-white/10 ${
                isCompactSplitLayout ? 'h-px w-full' : 'h-full w-px'
              }`}
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{previewerNode}</div>
          </div>
        )}
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-white/10 bg-[#111319]">{footer}</div>
      ) : null}
    </div>
  );
}
