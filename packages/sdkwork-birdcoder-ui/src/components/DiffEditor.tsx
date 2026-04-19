import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DiffEditor as MonacoDiffEditor, useMonaco } from '@monaco-editor/react';
import { Loader2, WrapText, Columns, LayoutTemplate } from 'lucide-react';
import { globalEventBus, useToast } from '@sdkwork/birdcoder-commons';
import { resolveMonacoOverflowWidgetsDomNode } from './monacoOverflowWidgets';
import {
  applyBirdCoderMonacoTheme,
  configureBirdCoderMonacoTypeScriptDefaults,
  observeBirdCoderMonacoLayout,
} from './monacoRuntime';

interface DiffEditorProps {
  language: string;
  original: string;
  modified: string;
  readOnly?: boolean;
  renderSideBySide?: boolean;
}

export function DiffEditor({ language, original, modified, readOnly = false, renderSideBySide = false }: DiffEditorProps) {
  const monaco = useMonaco();
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [isSideBySide, setIsSideBySide] = useState(renderSideBySide);
  const { addToast } = useToast();

  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const overflowWidgetsDomNode = useMemo(() => resolveMonacoOverflowWidgetsDomNode(), []);
  const [mountedEditor, setMountedEditor] = useState<any | null>(null);
  const diffEditorThemeDefinition = useMemo(
    () => ({
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
        'diffEditor.insertedTextBackground': '#10b98120',
        'diffEditor.removedTextBackground': '#ef444420',
        'diffEditor.insertedLineBackground': '#10b98110',
        'diffEditor.removedLineBackground': '#ef444410',
        'diffEditor.diagonalFill': '#282828',
      },
    }),
    [],
  );

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setMountedEditor(editor);
  };

  useEffect(() => {
    setIsSideBySide(renderSideBySide);
  }, [renderSideBySide]);

  useEffect(() => {
    const handleEditorCommand = (command: string) => {
      if (!editorRef.current) return;
      const editor = editorRef.current.getModifiedEditor();
      if (!editor) return;
      switch (command) {
        case 'undo': editor.trigger('keyboard', 'undo', null); break;
        case 'redo': editor.trigger('keyboard', 'redo', null); break;
        case 'cut': editor.trigger('keyboard', 'editor.action.clipboardCutAction', null); break;
        case 'copy': editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null); break;
        case 'paste': editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null); break;
        case 'delete': editor.trigger('keyboard', 'deleteLeft', null); break;
        case 'selectAll': editor.setSelection(editor.getModel().getFullModelRange()); break;
      }
    };

    globalEventBus.on('editorCommand', handleEditorCommand);

    return () => {
      globalEventBus.off('editorCommand', handleEditorCommand);
    };
  }, []);

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
    if (monaco) {
      configureBirdCoderMonacoTypeScriptDefaults(monaco as never);
      applyBirdCoderMonacoTheme(
        monaco as never,
        'vscode-dark-modern-diff',
        diffEditorThemeDefinition,
      );
    }
  }, [diffEditorThemeDefinition, monaco]);

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
      className="flex-1 h-full w-full animate-in fade-in duration-500 fill-mode-both relative group"
    >
      {/* Floating Toolbar */}
      <div className="absolute top-4 right-6 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center justify-center px-2 h-7 bg-[#18181b]/90 text-xs text-gray-400 font-mono rounded-md shadow-lg border border-white/10 backdrop-blur-sm mr-1">
          {language}
        </div>
        <button 
          onClick={toggleSideBySide}
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${isSideBySide ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title={isSideBySide ? "Switch to Inline View" : "Switch to Side-by-Side View"}
        >
          {isSideBySide ? <Columns size={14} /> : <LayoutTemplate size={14} />}
        </button>
        <button 
          onClick={toggleWordWrap}
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${wordWrap === 'on' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title="Toggle Word Wrap"
        >
          <WrapText size={14} />
        </button>
      </div>

      <MonacoDiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme="vscode-dark-modern-diff"
        loading={loadingComponent}
        onMount={handleEditorDidMount}
        options={{
          overflowWidgetsDomNode: overflowWidgetsDomNode,
          fixedOverflowWidgets: true,
          automaticLayout: false,
          minimap: { enabled: true, scale: 0.75, renderCharacters: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          lineHeight: 24,
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
          diffWordWrap: wordWrap,
          enableSplitViewResizing: true,
        }}
      />
    </div>
  );
}
