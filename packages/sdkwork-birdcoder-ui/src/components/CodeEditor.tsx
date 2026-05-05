import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { AlignLeft, Check, Copy, Loader2, Map, WrapText } from 'lucide-react';
import { globalEventBus, useToast } from '@sdkwork/birdcoder-commons';
import { copyTextToClipboard } from './clipboard';
import { resolveMonacoOverflowWidgetsDomNode } from './monacoOverflowWidgets';
import {
  applyBirdCoderMonacoTheme,
  configureBirdCoderMonacoTypeScriptDefaults,
  observeBirdCoderMonacoLayout,
} from './monacoRuntime';
import { cn } from '@sdkwork/birdcoder-ui-shell';

export interface CodeEditorProps {
  className?: string;
  defaultShowMinimap?: boolean;
  defaultWordWrap?: 'on' | 'off';
  formatOnPaste?: boolean;
  formatOnType?: boolean;
  language: string;
  loadingLabel?: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  showLanguageBadge?: boolean;
  showToolbar?: boolean;
  themeDefinition?: Record<string, unknown>;
  themeId?: string;
  value: string;
}

const DEFAULT_CODE_EDITOR_THEME_ID = 'birdcoder-content-editor';

const DEFAULT_CODE_EDITOR_THEME_DEFINITION = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
  ],
  colors: {
    'editor.background': '#0e0e11',
    'editor.foreground': '#D4D4D4',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#cccccc',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#3A3D41',
    'editorCursor.foreground': '#AEAFAD',
    'editorWhitespace.foreground': '#404040',
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',
    'editorLineHighlight.background': '#ffffff0a',
    'editorLineHighlight.border': '#28282800',
    'scrollbarSlider.background': '#79797933',
    'scrollbarSlider.hoverBackground': '#646464b3',
    'scrollbarSlider.activeBackground': '#bfbfbf66',
    'editorBracketMatch.background': '#0064001a',
    'editorBracketMatch.border': '#888888',
    'editorWidget.background': '#252526',
    'editorWidget.border': '#454545',
    'editorSuggestWidget.background': '#252526',
    'editorSuggestWidget.border': '#454545',
    'editorSuggestWidget.foreground': '#D4D4D4',
    'editorSuggestWidget.highlightForeground': '#18A3FF',
    'editorSuggestWidget.selectedBackground': '#062F4A',
  },
};

export function CodeEditor({
  className,
  defaultShowMinimap = true,
  defaultWordWrap = 'on',
  formatOnPaste = true,
  formatOnType = true,
  language,
  loadingLabel = 'Initializing Editor...',
  onChange,
  readOnly = false,
  showLanguageBadge = true,
  showToolbar = true,
  themeDefinition = DEFAULT_CODE_EDITOR_THEME_DEFINITION,
  themeId = DEFAULT_CODE_EDITOR_THEME_ID,
  value,
}: CodeEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const overflowWidgetsDomNode = useMemo(() => resolveMonacoOverflowWidgetsDomNode(), []);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>(defaultWordWrap);
  const [showMinimap, setShowMinimap] = useState(defaultShowMinimap);
  const [copied, setCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [mountedEditor, setMountedEditor] = useState<any | null>(null);
  const { addToast } = useToast();

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setMountedEditor(editor);
  };

  const handleFormat = () => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.getAction('editor.action.formatDocument').run();
    addToast('Document formatted', 'success');
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
        case 'selectAll':
          editor.setSelection(editor.getModel().getFullModelRange());
          break;
        default:
          break;
      }
    };

    globalEventBus.on('editorCommand', handleEditorCommand);

    return () => {
      globalEventBus.off('editorCommand', handleEditorCommand);
    };
  }, []);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    configureBirdCoderMonacoTypeScriptDefaults(monaco as never);
    applyBirdCoderMonacoTheme(monaco as never, themeId, themeDefinition);
  }, [monaco, themeDefinition, themeId]);

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
      className={cn(
        'relative h-full w-full flex-1 animate-in fade-in duration-500 fill-mode-both group',
        className,
      )}
    >
      {showToolbar ? (
        <div className="absolute right-6 top-4 z-10 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {showLanguageBadge ? (
            <div className="mr-1 flex h-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 px-2 font-mono text-xs text-gray-400 shadow-lg backdrop-blur-sm">
              {language}
            </div>
          ) : null}
          {!readOnly ? (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 text-gray-400 shadow-lg transition-all hover:bg-white/10 hover:text-gray-200 backdrop-blur-sm"
              onClick={handleFormat}
              title="Format Document"
              type="button"
            >
              <AlignLeft size={14} />
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
            title="Toggle Word Wrap"
            type="button"
          >
            <WrapText size={14} />
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
            title="Toggle Minimap"
            type="button"
          >
            <Map size={14} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#18181b]/90 text-gray-400 shadow-lg transition-all hover:bg-white/10 hover:text-gray-200 backdrop-blur-sm"
            onClick={handleCopy}
            title="Copy Content"
            type="button"
          >
            {copied ? <Check className="text-green-400" size={14} /> : <Copy size={14} />}
          </button>
        </div>
      ) : null}

      <Editor
        height="100%"
        language={language}
        loading={loadingComponent}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          overflowWidgetsDomNode: overflowWidgetsDomNode,
          fixedOverflowWidgets: true,
          automaticLayout: false,
          minimap: { enabled: showMinimap, scale: 0.75, renderCharacters: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          lineHeight: 24,
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
        theme={themeId}
        value={value}
      />
    </div>
  );
}
