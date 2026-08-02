import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import { resolveBirdCoderMonacoWorkerKind } from './monacoWorkerRouting';

interface BirdCoderMonacoEnvironment {
  getWorker(moduleId: string, label: string): Worker;
}

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: Partial<BirdCoderMonacoEnvironment>;
};

let isBirdCoderMonacoLoaderConfigured = false;

function createBirdCoderMonacoWorker(label: string): Worker {
  switch (resolveBirdCoderMonacoWorkerKind(label)) {
    case 'css':
      return new CssWorker();
    case 'html':
      return new HtmlWorker();
    case 'json':
      return new JsonWorker();
    case 'typescript':
      return new TypeScriptWorker();
    default:
      return new EditorWorker();
  }
}

export function configureBirdCoderMonacoLoader(): void {
  if (isBirdCoderMonacoLoaderConfigured) {
    return;
  }

  const monacoGlobal = globalThis as MonacoGlobal;
  monacoGlobal.MonacoEnvironment = {
    ...monacoGlobal.MonacoEnvironment,
    getWorker: (_moduleId, label) => createBirdCoderMonacoWorker(label),
  };
  loader.config({ monaco });
  isBirdCoderMonacoLoaderConfigured = true;
}
