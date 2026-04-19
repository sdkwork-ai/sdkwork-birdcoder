import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Loader2, AlignLeft, WrapText, Copy, Check, Map } from 'lucide-react';
import { globalEventBus, useToast } from '@sdkwork/birdcoder-commons';
import { resolveMonacoOverflowWidgetsDomNode } from './monacoOverflowWidgets';
import {
  applyBirdCoderMonacoTheme,
  configureBirdCoderMonacoTypeScriptDefaults,
  observeBirdCoderMonacoLayout,
} from './monacoRuntime';

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  readOnly?: boolean;
}

export function CodeEditor({ language, value, onChange, readOnly = false }: CodeEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [showMinimap, setShowMinimap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mountedEditor, setMountedEditor] = useState<any | null>(null);
  const { addToast } = useToast();
  const overflowWidgetsDomNode = useMemo(() => resolveMonacoOverflowWidgetsDomNode(), []);
  const codeEditorThemeDefinition = useMemo(
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
        'editorWidget.background': '#252526',
        'editorWidget.border': '#454545',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.foreground': '#D4D4D4',
        'editorSuggestWidget.highlightForeground': '#18A3FF',
        'editorSuggestWidget.selectedBackground': '#062F4A',
      },
    }),
    [],
  );

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setMountedEditor(editor);
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      addToast('Document formatted', 'success');
    }
  };

  const toggleWordWrap = () => {
    setWordWrap(prev => {
      const next = prev === 'on' ? 'off' : 'on';
      addToast(`Word wrap ${next}`, 'info');
      return next;
    });
  };

  const toggleMinimap = () => {
    setShowMinimap(prev => {
      const next = !prev;
      addToast(`Minimap ${next ? 'shown' : 'hidden'}`, 'info');
      return next;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    addToast('Code copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const handleEditorCommand = (command: string) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
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

  useEffect(() => {
    if (monaco) {
      configureBirdCoderMonacoTypeScriptDefaults(monaco as never);
      applyBirdCoderMonacoTheme(
        monaco as never,
        'vscode-dark-modern',
        codeEditorThemeDefinition,
      );
    }
  }, [codeEditorThemeDefinition, monaco]);

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
    <div className="flex items-center justify-center h-full w-full bg-[#0e0e11] text-gray-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Initializing Editor...</span>
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
        {!readOnly && (
          <button 
            onClick={handleFormat}
            className="flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all"
            title="Format Document (Shift+Alt+F)"
          >
            <AlignLeft size={14} />
          </button>
        )}
        <button 
          onClick={toggleWordWrap}
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${wordWrap === 'on' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title="Toggle Word Wrap"
        >
          <WrapText size={14} />
        </button>
        <button 
          onClick={toggleMinimap}
          className={`flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all ${showMinimap ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          title="Toggle Minimap"
        >
          <Map size={14} />
        </button>
        <button 
          onClick={handleCopy}
          className="flex items-center justify-center w-7 h-7 bg-[#18181b]/90 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-md shadow-lg border border-white/10 backdrop-blur-sm transition-all"
          title="Copy Code"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>

      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        theme="vscode-dark-modern"
        loading={loadingComponent}
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
          readOnly: readOnly,
          wordWrap: wordWrap,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          formatOnPaste: true,
          formatOnType: true,
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
      />
    </div>
  );
}
