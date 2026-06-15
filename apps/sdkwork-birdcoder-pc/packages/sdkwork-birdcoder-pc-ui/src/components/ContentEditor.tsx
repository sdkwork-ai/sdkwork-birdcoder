import { Suspense, lazy } from 'react';
import type { CodeEditorProps } from './CodeEditor';

const DeferredCodeEditor = lazy(async () => {
  const module = await import('./CodeEditor');
  return { default: module.CodeEditor };
});

export interface ContentEditorProps extends CodeEditorProps {}

function ContentEditorLoadingState() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0e0e11] text-sm text-gray-400">
      Loading editor...
    </div>
  );
}

export function ContentEditor(props: ContentEditorProps) {
  return (
    <Suspense fallback={<ContentEditorLoadingState />}>
      <DeferredCodeEditor {...props} />
    </Suspense>
  );
}
