import { Suspense, lazy, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@sdkwork/birdcoder-ui-shell';
import { resolveSafeMarkdownHref } from './markdownLinkSecurity';

export interface ContentMarkdownPreviewProps {
  className?: string;
  value: string;
}

const UniversalChatCodeBlock = lazy(async () => {
  const module = await import('./UniversalChatCodeBlock');
  return { default: module.UniversalChatCodeBlock };
});

function PlainCodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language: string;
}) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]">
      <div className="border-b border-white/5 bg-white/5 px-4 py-2 text-xs font-mono text-gray-400">
        {language || 'text'}
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-4 text-[13px] leading-relaxed text-gray-200">
        <code>{String(children).replace(/\n$/u, '')}</code>
      </pre>
    </div>
  );
}

export function ContentMarkdownPreview({
  className,
  value,
}: ContentMarkdownPreviewProps) {
  return (
    <div className={cn('h-full overflow-auto bg-[#0b0d12] custom-scrollbar', className)}>
      <div className="mx-auto min-h-full w-full max-w-4xl px-6 py-6">
        <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:text-gray-100 prose-p:text-gray-300 prose-p:leading-7 prose-strong:text-white prose-code:rounded-md prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-gray-100 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 prose-blockquote:border-l-blue-400 prose-blockquote:text-gray-300 prose-a:text-blue-300 hover:prose-a:text-blue-200 prose-li:text-gray-300 prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-th:text-left prose-th:text-gray-200 prose-td:text-gray-300">
          <ReactMarkdown
            components={{
              a: ({ children, href }) => {
                const safeHref = resolveSafeMarkdownHref(href);
                if (!safeHref) {
                  return <span>{children}</span>;
                }

                return (
                  <a
                    href={safeHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {children}
                  </a>
                );
              },
              code: ({ className: codeClassName, children, ...props }: any) => {
                const match = /language-(\w+)/u.exec(codeClassName || '');
                const language = match ? match[1] : '';
                const isInline = !match;

                if (isInline) {
                  return (
                    <code
                      className="rounded-md bg-white/10 px-1.5 py-0.5 text-[13px] text-gray-100"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return (
                  <Suspense fallback={<PlainCodeBlock language={language}>{children}</PlainCodeBlock>}>
                    <UniversalChatCodeBlock language={language}>
                      {children}
                    </UniversalChatCodeBlock>
                  </Suspense>
                );
              },
              pre: ({ children }) => <>{children}</>,
            }}
          >
            {value}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
