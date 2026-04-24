import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@sdkwork/birdcoder-ui-shell';
import {
  buildHtmlPreviewDocument,
  buildSvgPreviewDocument,
  resolveContentPreviewDescriptor,
  resolveContentPreviewSandbox,
  type ContentPreviewKind,
  type ResolvedContentPreviewDescriptor,
  type ContentPreviewSandboxPolicy,
} from './contentPreview.ts';

export interface ContentPreviewerProps {
  className?: string;
  emptyState?: ReactNode;
  htmlBaseUrl?: string;
  htmlDocumentTitle?: string;
  htmlSandbox?: string;
  htmlSandboxPolicy?: ContentPreviewSandboxPolicy;
  descriptor?: ResolvedContentPreviewDescriptor;
  kind?: ContentPreviewKind;
  language?: string;
  onResolvedKindChange?: (kind: ResolvedContentPreviewDescriptor['kind']) => void;
  path?: string;
  value: string;
}

const ContentMarkdownPreview = lazy(async () => {
  const module = await import('./ContentMarkdownPreview.tsx');
  return { default: module.ContentMarkdownPreview };
});

const ContentCodePreview = lazy(async () => {
  const module = await import('./ContentCodePreview.tsx');
  return { default: module.ContentCodePreview };
});

const ContentStructuredDataPreview = lazy(async () => {
  const module = await import('./ContentStructuredDataPreview.tsx');
  return { default: module.ContentStructuredDataPreview };
});

const ContentKeyValuePreview = lazy(async () => {
  const module = await import('./ContentKeyValuePreview.tsx');
  return { default: module.ContentKeyValuePreview };
});

const ContentTablePreview = lazy(async () => {
  const module = await import('./ContentTablePreview.tsx');
  return { default: module.ContentTablePreview };
});

function PreviewLoadingState({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0b0d12] text-sm text-gray-400">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function DefaultEmptyPreviewState() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0b0d12] px-6 text-center text-sm text-gray-500">
      Preview is available once the file has visible content.
    </div>
  );
}

function PlainTextPreview({
  value,
}: {
  value: string;
}) {
  return (
    <div className="h-full overflow-auto bg-[#0b0d12] custom-scrollbar">
      <pre className="min-h-full whitespace-pre-wrap break-words px-6 py-6 font-mono text-[13px] leading-6 text-gray-300">
        {value}
      </pre>
    </div>
  );
}

function CodePreview({
  className,
  language,
  value,
}: {
  className?: string;
  language: string;
  value: string;
}) {
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <Suspense fallback={<PreviewLoadingState label="Rendering code preview..." />}>
        <ContentCodePreview language={language} value={value} />
      </Suspense>
    </div>
  );
}

export function ContentPreviewer({
  className,
  emptyState,
  htmlBaseUrl,
  htmlDocumentTitle,
  htmlSandbox,
  htmlSandboxPolicy = 'balanced',
  descriptor,
  kind = 'auto',
  language,
  onResolvedKindChange,
  path,
  value,
}: ContentPreviewerProps) {
  const deferredValue = useDeferredValue(value);
  const previewDescriptor = useMemo(
    () =>
      descriptor ??
      resolveContentPreviewDescriptor({
        kind,
        language,
        path,
        value: deferredValue,
      }),
    [deferredValue, descriptor, kind, language, path],
  );
  const normalizedValue = previewDescriptor.sourceValue.trim();
  const resolvedSandbox = useMemo(
    () => resolveContentPreviewSandbox(htmlSandboxPolicy, htmlSandbox),
    [htmlSandbox, htmlSandboxPolicy],
  );

  useEffect(() => {
    onResolvedKindChange?.(previewDescriptor.kind);
  }, [onResolvedKindChange, previewDescriptor.kind]);

  const htmlPreviewDocument = useMemo(() => {
    if (previewDescriptor.presentation === 'svg') {
      return buildSvgPreviewDocument(previewDescriptor.sourceValue, {
        baseUrl: htmlBaseUrl,
        title: htmlDocumentTitle,
      });
    }

    if (previewDescriptor.presentation === 'html') {
      return buildHtmlPreviewDocument(previewDescriptor.sourceValue, {
        baseUrl: htmlBaseUrl,
        title: htmlDocumentTitle,
      });
    }

    return null;
  }, [htmlBaseUrl, htmlDocumentTitle, previewDescriptor.presentation, previewDescriptor.sourceValue]);

  if (!normalizedValue) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        {emptyState ?? <DefaultEmptyPreviewState />}
      </div>
    );
  }

  if (previewDescriptor.presentation === 'html' || previewDescriptor.presentation === 'svg') {
    return (
      <div className={cn('flex-1 min-h-0 bg-[#0b0d12]', className)}>
        <iframe
          className="h-full w-full border-0 bg-white"
          sandbox={resolvedSandbox}
          srcDoc={htmlPreviewDocument ?? ''}
          title={htmlDocumentTitle?.trim() || previewDescriptor.path?.trim() || 'Content Preview'}
        />
      </div>
    );
  }

  if (previewDescriptor.presentation === 'markdown') {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label="Rendering Markdown preview..." />}>
          <ContentMarkdownPreview value={previewDescriptor.sourceValue} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'structured-data' && previewDescriptor.structuredData !== null) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label="Rendering structured data preview..." />}>
          <ContentStructuredDataPreview
            format={previewDescriptor.structuredData.format}
            value={previewDescriptor.structuredData.value}
          />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'key-value' && previewDescriptor.keyValueData !== null) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label="Rendering config preview..." />}>
          <ContentKeyValuePreview value={previewDescriptor.keyValueData} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'table' && previewDescriptor.tabularData !== null) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label="Rendering table preview..." />}>
          <ContentTablePreview value={previewDescriptor.tabularData} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'code') {
    return <CodePreview className={className} language={previewDescriptor.codeLanguage} value={previewDescriptor.sourceValue} />;
  }

  if (previewDescriptor.presentation === 'structured-data') {
    if (previewDescriptor.codeLanguage !== 'text') {
      return (
        <CodePreview
          className={className}
          language={previewDescriptor.codeLanguage}
          value={previewDescriptor.sourceValue}
        />
      );
    }

    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <PlainTextPreview value={previewDescriptor.sourceValue} />
      </div>
    );
  }

  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <PlainTextPreview value={previewDescriptor.sourceValue} />
    </div>
  );
}
