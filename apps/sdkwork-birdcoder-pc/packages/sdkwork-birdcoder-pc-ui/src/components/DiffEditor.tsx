import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DiffEditor as MonacoDiffEditor,
  type DiffOnMount,
  type Monaco,
  useMonaco,
} from '@monaco-editor/react';
import type { editor, IDisposable } from 'monaco-editor';
import { Loader2, WrapText, Columns, LayoutTemplate } from 'lucide-react';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useBirdcoderAppSettings } from '@sdkwork/birdcoder-pc-workbench/hooks/useBirdcoderAppSettings';
import { useBirdcoderTheme } from '@sdkwork/birdcoder-pc-workbench/theme/birdcoderTheme';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { resolveMonacoOverflowWidgetsDomNode } from './monacoOverflowWidgets';
import {
  applyBirdCoderMonacoTheme,
  configureBirdCoderMonacoTypeScriptDefaults,
  observeBirdCoderMonacoLayout,
  synchronizeBirdCoderMonacoModelLanguage,
} from './monacoRuntime';
import { configureBirdCoderMonacoLanguages } from './monacoLanguageSupport';
import { resolveBirdCoderEditorLanguageLabel } from './editorLanguage';
import { createBirdCoderEditorTheme } from './editorTheme';
import {
  claimEditorCommandTarget,
  ownsEditorCommandTarget,
  releaseEditorCommandTarget,
} from './editorCommandFocus';

export interface DiffEditorProps {
  language: string;
  original: string;
  modified: string;
  readOnly?: boolean;
  renderSideBySide?: boolean;
}

export function DiffEditor({ language, original, modified, readOnly = false, renderSideBySide = false }: DiffEditorProps) {
  const monaco = useMonaco();
  const { settings: appSettings } = useBirdcoderAppSettings();
  const birdcoderTheme = useBirdcoderTheme();
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>(
    appSettings.wordWrap ? 'on' : 'off',
  );
  const [isSideBySide, setIsSideBySide] = useState(renderSideBySide);
  const { addToast } = useToast();
  const languageLabel = resolveBirdCoderEditorLanguageLabel(language);

  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const editorCommandTargetRef = useRef<object>({});
  const focusedDiffEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const focusDisposablesRef = useRef<IDisposable[]>([]);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const overflowWidgetsDomNode = useMemo(() => resolveMonacoOverflowWidgetsDomNode(), []);
  const [mountedEditor, setMountedEditor] = useState<editor.IStandaloneDiffEditor | null>(null);
  const editorThemeId = `birdcoder-${birdcoderTheme.colorMode}-professional`;
  const editorThemeDefinition = useMemo(
    () => createBirdCoderEditorTheme(birdcoderTheme),
    [birdcoderTheme],
  );
  const codeFontSize = Number.parseInt(birdcoderTheme.codeFontSize, 10) || 12;

  const handleEditorDidMount: DiffOnMount = (mountedEditorInstance) => {
    editorRef.current = mountedEditorInstance;
    setMountedEditor(mountedEditorInstance);
    const modifiedEditor = mountedEditorInstance.getModifiedEditor();
    const originalEditor = mountedEditorInstance.getOriginalEditor();
    focusDisposablesRef.current.forEach((disposable) => disposable.dispose());
    focusDisposablesRef.current = [modifiedEditor, originalEditor].map((candidate) =>
      candidate.onDidFocusEditorText(() => {
        focusedDiffEditorRef.current = candidate;
        claimEditorCommandTarget(editorCommandTargetRef.current);
      }),
    );
    const focusedEditor = modifiedEditor.hasTextFocus()
      ? modifiedEditor
      : originalEditor.hasTextFocus()
        ? originalEditor
        : null;
    if (focusedEditor) {
      focusedDiffEditorRef.current = focusedEditor;
      claimEditorCommandTarget(editorCommandTargetRef.current);
    }
  };

  const configureMonaco = useCallback((monacoApi: Monaco) => {
    configureBirdCoderMonacoLanguages(monacoApi);
    configureBirdCoderMonacoTypeScriptDefaults(monacoApi);
    applyBirdCoderMonacoTheme(
      monacoApi,
      editorThemeId,
      editorThemeDefinition,
    );
  }, [editorThemeDefinition, editorThemeId]);

  useEffect(() => {
    setIsSideBySide(renderSideBySide);
  }, [renderSideBySide]);

  useEffect(() => {
    setWordWrap(appSettings.wordWrap ? 'on' : 'off');
  }, [appSettings.wordWrap]);

  useEffect(() => {
    const handleEditorCommand = (command: string) => {
      if (!editorRef.current) return;
      if (!ownsEditorCommandTarget(editorCommandTargetRef.current)) return;
      const editor = focusedDiffEditorRef.current ?? editorRef.current.getModifiedEditor();
      if (!editor) return;
      switch (command) {
        case 'undo': editor.trigger('keyboard', 'undo', null); break;
        case 'redo': editor.trigger('keyboard', 'redo', null); break;
        case 'cut': editor.trigger('keyboard', 'editor.action.clipboardCutAction', null); break;
        case 'copy': editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null); break;
        case 'paste': editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null); break;
        case 'delete': editor.trigger('keyboard', 'deleteLeft', null); break;
        case 'selectAll': {
          const model = editor.getModel();
          if (model) editor.setSelection(model.getFullModelRange());
          break;
        }
      }
    };

    globalEventBus.on('editorCommand', handleEditorCommand);

    return () => {
      globalEventBus.off('editorCommand', handleEditorCommand);
    };
  }, []);

  useEffect(
    () => () => {
      focusDisposablesRef.current.forEach((disposable) => disposable.dispose());
      focusDisposablesRef.current = [];
      releaseEditorCommandTarget(editorCommandTargetRef.current);
    },
    [],
  );

  const toggleWordWrap = () => {
    setWordWrap(prev => {
      const next = prev === 'on' ? 'off' : 'on';
      addToast(`Word wrap ${next}`, 'info');
      return next;
    });
  };

  const toggleSideBySide = () => {
    setIsSideBySide(prev => {
      const next = !prev;
      addToast(`Switched to ${next ? 'side-by-side' : 'inline'} view`, 'info');
      return next;
    });
  };

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
      mountedEditor.getOriginalEditor().getModel(),
      language,
    );
    synchronizeBirdCoderMonacoModelLanguage(
      monaco,
      mountedEditor.getModifiedEditor().getModel(),
      language,
    );
  }, [language, monaco, mountedEditor]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!mountedEditor || !container) {
      return undefined;
    }

    const cleanupLayoutObserver = observeBirdCoderMonacoLayout(container, mountedEditor);
    return () => {
      cleanupLayoutObserver();
    };
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
  }, [isSideBySide, mountedEditor, wordWrap]);

  const loadingComponent = (
    <div className="flex items-center justify-center h-full w-full bg-[#0e0e11] text-gray-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Initializing Diff Editor...</span>
      </div>
    </div>
  );

  return (
    <div
      ref={editorContainerRef}
      onFocusCapture={() => claimEditorCommandTarget(editorCommandTargetRef.current)}
      className="flex-1 h-full w-full animate-in fade-in duration-500 fill-mode-both relative group"
    >
      {/* Floating Toolbar */}
      <div className="absolute top-4 right-6 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center justify-center px-2 h-7 bg-[#161b22]/95 text-xs text-gray-300 font-mono rounded-md shadow-lg border border-white/10 backdrop-blur-sm mr-1">
          {languageLabel}
        </div>
        <button 
          onClick={toggleSideBySide}
          aria-label={isSideBySide ? 'Switch to inline diff view' : 'Switch to side-by-side diff view'}
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${isSideBySide ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title={isSideBySide ? "Switch to Inline View" : "Switch to Side-by-Side View"}
          type="button"
        >
          {isSideBySide ? <Columns aria-hidden="true" size={14} /> : <LayoutTemplate aria-hidden="true" size={14} />}
        </button>
        <button 
          onClick={toggleWordWrap}
          aria-label="Toggle word wrap"
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${wordWrap === 'on' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title="Toggle Word Wrap"
          type="button"
        >
          <WrapText aria-hidden="true" size={14} />
        </button>
      </div>

      <MonacoDiffEditor
        beforeMount={configureMonaco}
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme={editorThemeId}
        loading={loadingComponent}
        onMount={handleEditorDidMount}
        options={{
          overflowWidgetsDomNode: overflowWidgetsDomNode,
          fixedOverflowWidgets: true,
          automaticLayout: false,
          minimap: { enabled: appSettings.minimap, scale: 0.75, renderCharacters: false },
          fontSize: codeFontSize,
          fontFamily: birdcoderTheme.codeFontFamily,
          fontLigatures: true,
          lineHeight: Math.max(18, Math.round(codeFontSize * 1.65)),
          lineNumbers: appSettings.showLineNumbers ? 'on' : 'off',
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          readOnly: readOnly,
          wordWrap: wordWrap,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          renderSideBySide: isSideBySide,
          ignoreTrimWhitespace: false,
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
          diffWordWrap: wordWrap,
          enableSplitViewResizing: true,
        }}
      />
    </div>
  );
}
