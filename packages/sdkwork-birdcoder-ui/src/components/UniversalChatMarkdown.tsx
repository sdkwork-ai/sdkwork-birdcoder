import React, { Suspense, lazy } from 'react';
import { Hexagon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatSkill } from './UniversalChat';
import { resolveSafeMarkdownHref } from './markdownLinkSecurity';

export interface UniversalChatMarkdownProps {
  content: string;
  skills?: ChatSkill[];
  mode?: 'basic' | 'rich';
}

const UniversalChatCodeBlock = lazy(async () => {
  const module = await import('./UniversalChatCodeBlock');
  return { default: module.UniversalChatCodeBlock };
});

function processContent(content: string) {
  return content.replace(
    /Skill\s*([a-zA-Z0-9\s]+?)(?=[,.!\n]|\sas|$)/g,
    '[$1](skill://$1)',
  );
}

function PlainCodeBlock({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 my-4 bg-[#0d0d0d] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs font-mono text-gray-400">{language || 'text'}</span>
      </div>
      <pre className="overflow-x-auto custom-scrollbar text-[13px] leading-relaxed font-mono m-0 p-4 bg-transparent text-gray-200">
        <code>{String(children).replace(/\n$/, '')}</code>
      </pre>
    </div>
  );
}

export function UniversalChatMarkdown({
  content,
  skills = [],
  mode = 'rich',
}: UniversalChatMarkdownProps) {
  const safeLinkComponents = {
    a: ({ node, ...props }: any) => {
      const safeHref = resolveSafeMarkdownHref(props.href, {
        allowSkillLinks: true,
      });
      if (!safeHref) {
        return <span>{props.children}</span>;
      }

      if (safeHref.startsWith('skill://')) {
        const skillName = decodeURIComponent(safeHref.replace('skill://', '')).trim();
        const skill =
          skills.find((entry) => entry.name.toLowerCase() === skillName.toLowerCase())
          || {
            name: skillName,
            desc: `Provides specialized capabilities for ${skillName}.`,
          };
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 cursor-help group relative mx-1 align-middle">
            <Hexagon size={12} className="text-purple-400 fill-purple-400/20" />
            <span className="font-medium text-[13px]">{skill.name}</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-[#18181b] text-gray-200 text-xs rounded shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-normal">
              {skill.desc}
            </span>
          </span>
        );
      }

      return (
        <a
          href={safeHref}
          rel="noopener noreferrer"
          target="_blank"
          className="text-blue-400 hover:underline"
        >
          {props.children}
        </a>
      );
    },
  };

  if (mode === 'basic') {
    return <ReactMarkdown components={safeLinkComponents}>{content}</ReactMarkdown>;
  }

  const markdownComponents = {
    ...safeLinkComponents,
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isInline = inline || !match;

      if (isInline) {
        return (
          <code
            className="bg-white/10 px-1.5 py-0.5 rounded-md text-[13px] font-mono text-gray-200"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <Suspense fallback={<PlainCodeBlock language={language}>{children}</PlainCodeBlock>}>
          <UniversalChatCodeBlock language={language} className={className} {...props}>
            {children}
          </UniversalChatCodeBlock>
        </Suspense>
      );
    },
    pre: ({ children }: any) => <>{children}</>,
  };

  return (
    <ReactMarkdown components={markdownComponents}>
      {processContent(content)}
    </ReactMarkdown>
  );
}
