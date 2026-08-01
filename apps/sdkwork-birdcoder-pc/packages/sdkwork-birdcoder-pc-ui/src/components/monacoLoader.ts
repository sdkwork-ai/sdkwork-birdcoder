import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
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
