import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '@sdkwork/birdcoder-pc-ui-shell';
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
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0b0d12] px-6 text-center text-sm text-gray-500">
      {t('ui.previewAvailableWhenVisible')}
    </div>
  );
}

function CodePreview({
  className,
  language,
  value,
  loadingLabel,
}: {
  className?: string;
  language: string;
  value: string;
  loadingLabel: string;
}) {
  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <Suspense fallback={<PreviewLoadingState label={loadingLabel} />}>
        <ContentCodePreview language={language} value={value} />
      </Suspense>
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
  const { t } = useTranslation();
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
          title={htmlDocumentTitle?.trim() || previewDescriptor.path?.trim() || t('ui.contentPreview')}
        />
      </div>
    );
  }

  if (previewDescriptor.presentation === 'markdown') {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label={t('ui.renderingMarkdownPreview')} />}>
          <ContentMarkdownPreview value={previewDescriptor.sourceValue} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'structured-data' && previewDescriptor.structuredData !== null) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label={t('ui.renderingStructuredDataPreview')} />}>
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
        <Suspense fallback={<PreviewLoadingState label={t('ui.renderingConfigPreview')} />}>
          <ContentKeyValuePreview value={previewDescriptor.keyValueData} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'table' && previewDescriptor.tabularData !== null) {
    return (
      <div className={cn('flex-1 min-h-0', className)}>
        <Suspense fallback={<PreviewLoadingState label={t('ui.renderingTablePreview')} />}>
          <ContentTablePreview value={previewDescriptor.tabularData} />
        </Suspense>
      </div>
    );
  }

  if (previewDescriptor.presentation === 'code') {
    return (
      <CodePreview
        className={className}
        language={previewDescriptor.codeLanguage}
        loadingLabel={t('ui.renderingCodePreview')}
        value={previewDescriptor.sourceValue}
      />
    );
  }

  if (previewDescriptor.presentation === 'structured-data') {
    if (previewDescriptor.codeLanguage !== 'text') {
      return (
        <CodePreview
          className={className}
          language={previewDescriptor.codeLanguage}
          loadingLabel={t('ui.renderingCodePreview')}
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

