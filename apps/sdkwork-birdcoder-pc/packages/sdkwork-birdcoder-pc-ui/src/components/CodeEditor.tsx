import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, {
  type Monaco,
  type OnMount,
  useMonaco,
} from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { AlignLeft, Check, Copy, Loader2, Map, WrapText } from 'lucide-react';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useBirdcoderAppSettings } from '@sdkwork/birdcoder-pc-workbench/hooks/useBirdcoderAppSettings';
import { useBirdcoderTheme } from '@sdkwork/birdcoder-pc-workbench/theme/birdcoderTheme';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { copyTextToClipboard } from './clipboard';
import { resolveMonacoOverflowWidgetsDomNode } from './monacoOverflowWidgets';
import {
  applyBirdCoderMonacoTheme,
  configureBirdCoderMonacoTypeScriptDefaults,
  observeBirdCoderMonacoLayout,
  synchronizeBirdCoderMonacoModelLanguage,
} from './monacoRuntime';
import { configureBirdCoderMonacoLanguages } from './monacoLanguageSupport';
import {
  resolveBirdCoderEditorLanguageLabel,
} from './editorLanguage';
import { createBirdCoderEditorTheme } from './editorTheme';
import { cn } from '@sdkwork/birdcoder-pc-ui-shell';
import {
  claimEditorCommandTarget,
  ownsEditorCommandTarget,
  releaseEditorCommandTarget,
} from './editorCommandFocus';

export interface CodeEditorProps {
  className?: string;
  defaultShowMinimap?: boolean;
  defaultWordWrap?: 'on' | 'off';
  formatOnPaste?: boolean;
  formatOnType?: boolean;
  language: string;
  loadingLabel?: string;
  onChange?: (value: string | undefined) => void;
  path?: string;
  readOnly?: boolean;
  retainedModelPaths?: readonly string[];
  showLanguageBadge?: boolean;
  showToolbar?: boolean;
  themeDefinition?: editor.IStandaloneThemeData;
  themeId?: string;
  value: string;
}

export function CodeEditor({
  className,
  defaultShowMinimap,
  defaultWordWrap,
  formatOnPaste = true,
  formatOnType = true,
  language,
  loadingLabel = 'Initializing Editor...',
  onChange,
  path,
  readOnly = false,
  retainedModelPaths,
  showLanguageBadge = true,
  showToolbar = true,
  themeDefinition,
  themeId,
  value,
}: CodeEditorProps) {
  const monaco = useMonaco();
  const { settings: appSettings } = useBirdcoderAppSettings();
  const birdcoderTheme = useBirdcoderTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const ownedModelPathsRef = useRef(new Set<string>());
  const editorCommandTargetRef = useRef<object>({});
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const overflowWidgetsDomNode = useMemo(() => resolveMonacoOverflowWidgetsDomNode(), []);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>(
    defaultWordWrap ?? (appSettings.wordWrap ? 'on' : 'off'),
  );
  const [showMinimap, setShowMinimap] = useState(
    defaultShowMinimap ?? appSettings.minimap,
  );
  const [copied, setCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [mountedEditor, setMountedEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const { addToast } = useToast();
  const languageLabel = resolveBirdCoderEditorLanguageLabel(language);
  const resolvedThemeId = themeId ?? `birdcoder-${birdcoderTheme.colorMode}-professional`;
  const resolvedThemeDefinition = useMemo(
    () => themeDefinition ?? createBirdCoderEditorTheme(birdcoderTheme),
    [birdcoderTheme, themeDefinition],
  );
  const codeFontSize = Number.parseInt(birdcoderTheme.codeFontSize, 10) || 12;

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  const handleEditorDidMount: OnMount = (mountedEditorInstance) => {
    editorRef.current = mountedEditorInstance;
    setMountedEditor(mountedEditorInstance);
    if (mountedEditorInstance.hasTextFocus()) {
      claimEditorCommandTarget(editorCommandTargetRef.current);
    }
  };

  const configureMonaco = useCallback((monacoApi: Monaco) => {
    configureBirdCoderMonacoLanguages(monacoApi);
    configureBirdCoderMonacoTypeScriptDefaults(monacoApi);
    applyBirdCoderMonacoTheme(monacoApi, resolvedThemeId, resolvedThemeDefinition);
  }, [resolvedThemeDefinition, resolvedThemeId]);

  useEffect(() => {
    if (defaultWordWrap === undefined) {
      setWordWrap(appSettings.wordWrap ? 'on' : 'off');
    }
  }, [appSettings.wordWrap, defaultWordWrap]);

  useEffect(() => {
    if (defaultShowMinimap === undefined) {
      setShowMinimap(appSettings.minimap);
    }
  }, [appSettings.minimap, defaultShowMinimap]);

  const handleFormat = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const formatAction = editor.getAction?.('editor.action.formatDocument');
    if (!formatAction?.run) {
      addToast('Formatting is unavailable for this document', 'error');
      return;
    }

    try {
      await formatAction.run();
      addToast('Document formatted', 'success');
    } catch (error) {
      console.error('Failed to format document', error);
      addToast('Unable to format document', 'error');
    }
  };

  const handleCopy = async () => {
    const didCopy = await copyTextToClipboard(value);
    if (!didCopy) {
      addToast('Unable to copy content to clipboard', 'error');
      return;
    }

    setCopied(true);
    addToast('Content copied to clipboard', 'success');
    clearCopyFeedbackTimeout();
    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copyFeedbackTimeoutRef.current = null;
    }, 2_000);
  };

  useEffect(() => () => {
    clearCopyFeedbackTimeout();
  }, [clearCopyFeedbackTimeout]);

  useEffect(() => {
    const handleEditorCommand = (command: string) => {
      if (!editorRef.current) {
        return;
      }

      const editor = editorRef.current;
      if (!ownsEditorCommandTarget(editorCommandTargetRef.current)) {
        return;
      }
      switch (command) {
        case 'undo':
          editor.trigger('keyboard', 'undo', null);
          break;
        case 'redo':
          editor.trigger('keyboard', 'redo', null);
          break;
        case 'cut':
          editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
          break;
        case 'copy':
          editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
          break;
        case 'paste':
          editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
          break;
        case 'delete':
          editor.trigger('keyboard', 'deleteLeft', null);
          break;
        case 'selectAll': {
          const model = editor.getModel();
          if (model) {
            editor.setSelection(model.getFullModelRange());
          }
          break;
        }
        default:
          break;
      }
    };

    globalEventBus.on('editorCommand', handleEditorCommand);

    return () => {
      globalEventBus.off('editorCommand', handleEditorCommand);
    };
  }, []);

  useEffect(
    () => () => releaseEditorCommandTarget(editorCommandTargetRef.current),
    [],
  );

  useEffect(() => {
    if (!monaco) {
      return;
    }

    configureMonaco(monaco);
  }, [configureMonaco, monaco]);

  useEffect(() => {
    if (!monaco || !mountedEditor) {
      return;
    }

    synchronizeBirdCoderMonacoModelLanguage(
      monaco,
      mountedEditor.getModel(),
      language,
    );
  }, [language, monaco, mountedEditor, path]);

  useEffect(() => {
    if (!monaco || !path) {
      return;
    }

    ownedModelPathsRef.current.add(path);
    const retainedPaths = new Set(retainedModelPaths ?? [path]);
    retainedPaths.add(path);
    for (const ownedPath of ownedModelPathsRef.current) {
      if (retainedPaths.has(ownedPath)) {
        continue;
      }

      monaco.editor.getModel(monaco.Uri.parse(ownedPath))?.dispose();
      ownedModelPathsRef.current.delete(ownedPath);
    }
  }, [monaco, path, retainedModelPaths]);

  useEffect(() => {
    if (!monaco) {
      return undefined;
    }

    return () => {
      const activeModel = editorRef.current?.getModel?.();
      for (const ownedPath of ownedModelPathsRef.current) {
        const model = monaco.editor.getModel(monaco.Uri.parse(ownedPath));
        if (model && model !== activeModel) {
          model.dispose();
        }
      }
      ownedModelPathsRef.current.clear();
    };
  }, [monaco]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!mountedEditor || !container) {
      return undefined;
    }

    return observeBirdCoderMonacoLayout(container, mountedEditor);
  }, [mountedEditor]);

  useEffect(() => {
    if (!mountedEditor) {
      return undefined;
    }

    if (typeof window === 'undefined') {
      mountedEditor.layout();
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      mountedEditor.layout();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [mountedEditor, showMinimap, wordWrap]);

  const loadingComponent = (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] text-gray-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-sm font-medium">{loadingLabel}</span>
      </div>
    </div>
  );

  return (
    <div
      ref={editorContainerRef}
      onFocusCapture={() => claimEditorCommandTarget(editorCommandTargetRef.current)}
      className={cn(
        'relative h-full w-full flex-1 animate-in fade-in duration-500 fill-mode-both group',
        className,
      )}
    >
      {showToolbar ? (
        <div className="absolute right-6 top-4 z-10 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {showLanguageBadge ? (
            <div className="mr-1 flex h-7 items-center justify-center rounded-md border border-white/10 bg-[#161b22]/95 px-2 font-mono text-xs text-gray-300 shadow-lg backdrop-blur-sm">
              {languageLabel}
            </div>
          ) : null}
          {!readOnly ? (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 text-gray-400 shadow-lg transition-all hover:bg-white/10 hover:text-gray-200 backdrop-blur-sm"
              onClick={handleFormat}
              aria-label="Format document"
              title="Format Document"
              type="button"
            >
              <AlignLeft aria-hidden="true" size={14} />
            </button>
          ) : null}
          <button
            className={`flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 shadow-lg transition-all backdrop-blur-sm ${wordWrap === 'on' ? 'text-blue-400' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
            onClick={() => {
              setWordWrap((previousState) => {
                const nextState = previousState === 'on' ? 'off' : 'on';
                addToast(`Word wrap ${nextState}`, 'info');
                return nextState;
              });
            }}
            aria-label="Toggle word wrap"
            title="Toggle Word Wrap"
            type="button"
          >
            <WrapText aria-hidden="true" size={14} />
          </button>
          <button
            className={`flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 shadow-lg transition-all backdrop-blur-sm ${showMinimap ? 'text-blue-400' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
            onClick={() => {
              setShowMinimap((previousState) => {
                const nextState = !previousState;
                addToast(`Minimap ${nextState ? 'shown' : 'hidden'}`, 'info');
                return nextState;
              });
            }}
            aria-label="Toggle minimap"
            title="Toggle Minimap"
            type="button"
          >
            <Map aria-hidden="true" size={14} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 text-gray-400 shadow-lg transition-all hover:bg-white/10 hover:text-gray-200 backdrop-blur-sm"
            onClick={handleCopy}
            aria-label="Copy content"
            title="Copy Content"
            type="button"
          >
            {copied ? <Check aria-hidden="true" className="text-green-400" size={14} /> : <Copy aria-hidden="true" size={14} />}
          </button>
        </div>
      ) : null}

      <Editor
        beforeMount={configureMonaco}
        height="100%"
        language={language}
        loading={loadingComponent}
        onChange={onChange}
        onMount={handleEditorDidMount}
        path={path}
        saveViewState={Boolean(path)}
        options={{
          overflowWidgetsDomNode: overflowWidgetsDomNode,
          fixedOverflowWidgets: true,
          automaticLayout: false,
          minimap: { enabled: showMinimap, scale: 0.75, renderCharacters: false },
          fontSize: codeFontSize,
          fontFamily: birdcoderTheme.codeFontFamily,
          fontLigatures: true,
          lineHeight: Math.max(18, Math.round(codeFontSize * 1.65)),
          lineNumbers: appSettings.showLineNumbers ? 'on' : 'off',
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          readOnly,
          wordWrap,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          formatOnPaste,
          formatOnType,
          'semanticHighlighting.enabled': true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
          scrollbar: {
            verticalScrollbarSize: 12,
            horizontalScrollbarSize: 12,
            useShadows: false,
          },
          mouseWheelZoom: true,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'mouseover',
          renderWhitespace: 'selection',
          occurrencesHighlight: 'singleFile',
          selectionHighlight: true,
          links: true,
          colorDecorators: true,
          stickyScroll: { enabled: true, maxLineCount: 5 },
          unicodeHighlight: {
            ambiguousCharacters: false,
            invisibleCharacters: true,
            nonBasicASCII: false,
          },
          suggest: {
            showIcons: true,
            showStatusBar: true,
            preview: true,
            insertMode: 'replace',
            snippetsPreventQuickSuggestions: false,
          },
          hover: {
            delay: 300,
            enabled: true,
          },
          inlayHints: {
            enabled: 'on',
          },
        }}
        theme={resolvedThemeId}
        value={value}
      />
    </div>
  );
}

