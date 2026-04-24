import { Suspense, lazy } from 'react';
import { cn } from '@sdkwork/birdcoder-ui-shell';

export interface ContentCodePreviewProps {
  className?: string;
  language?: string;
  value: string;
}

const UniversalChatCodeBlock = lazy(async () => {
  const module = await import('./UniversalChatCodeBlock');
  return { default: module.UniversalChatCodeBlock };
});

function PlainCodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]">
      <div className="border-b border-white/5 bg-white/5 px-4 py-2 text-xs font-mono text-gray-400">
        {language || 'text'}
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-4 text-[13px] leading-relaxed text-gray-200">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function ContentCodePreview({
  className,
  language = 'text',
  value,
}: ContentCodePreviewProps) {
  return (
    <div className={cn('h-full overflow-auto bg-[#0b0d12] px-4 py-4 custom-scrollbar', className)}>
      <Suspense fallback={<PlainCodeBlock language={language} value={value} />}>
        <UniversalChatCodeBlock language={language}>{value}</UniversalChatCodeBlock>
      </Suspense>
    </div>
  );
}
