import React, { Suspense, lazy } from 'react';
import { FileCode2, Hexagon, RefreshCw, Workflow } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import type { ChatSkill } from './UniversalChat';
import { resolveChatCodeFenceLanguage } from './chatMarkdownHeuristics';
import {
  resolveMarkdownFilePath,
  resolveSafeMarkdownHref,
} from './markdownLinkSecurity';

export interface UniversalChatMarkdownProps {
  content: string;
  onOpenFile?: (path: string) => void;
  onOpenUrl?: (url: string) => void;
  openFileLabel?: string;
  openUrlLabel?: string;
  skills?: ChatSkill[];
  mode?: 'basic' | 'rich';
  unknownSkillDescription?: string;
}

const UniversalChatCodeBlock = lazy(async () => {
  const module = await import('./UniversalChatCodeBlock');
  return { default: module.UniversalChatCodeBlock };
});

const UniversalChatMermaid = lazy(async () => {
  const module = await import('./UniversalChatMermaid');
  return { default: module.UniversalChatMermaid };
});

const CHAT_MARKDOWN_REMARK_PLUGINS = [remarkGfm];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function processContent(content: string, skills: readonly ChatSkill[]) {
  const skillNames = skills
    .map((skill) => skill.name.trim())
    .filter((name) => name.length > 0)
    .sort((left, right) => right.length - left.length);

  if (skillNames.length === 0) {
    return content;
  }

  return skillNames.reduce((nextContent, skillName) => {
    const skillMentionPattern = new RegExp(
      `\\bSkill\\s+(${escapeRegExp(skillName)})(?=[,.!\\n]|\\sas\\b|$)`,
      'giu',
    );
    return nextContent.replace(
      skillMentionPattern,
      (_match, matchedName: string) =>
        `[${matchedName}](skill://${encodeURIComponent(skillName)})`,
    );
  }, content);
}

function decodeSkillHrefName(href: string): string | null {
  try {
    const skillName = decodeURIComponent(href.replace('skill://', '')).trim();
    return skillName.length > 0 ? skillName : null;
  } catch {
    return null;
  }
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

function MermaidBlockFallback() {
  const { t } = useTranslation();

  return (
    <figure
      className="my-3 max-w-full overflow-hidden rounded-md border border-white/10 bg-[#0b0d10]"
      aria-busy="true"
    >
      <figcaption className="flex min-h-9 items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-2.5 py-1">
        <Workflow size={14} className="shrink-0 text-sky-300/80" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
          {t('chat.mermaidDiagram')}
        </span>
      </figcaption>
      <div
        className="flex min-h-44 items-center justify-center p-4"
        role="status"
        aria-label={t('chat.mermaidRendering')}
      >
        <RefreshCw size={16} className="animate-spin text-gray-600" aria-hidden="true" />
      </div>
    </figure>
  );
}

function MarkdownCode({
  children,
  className,
  inline,
  rich,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  inline?: boolean;
  rich: boolean;
  [key: string]: unknown;
}) {
  const language = resolveChatCodeFenceLanguage(className);
  const isInline = inline || !language;

  if (isInline) {
    return (
      <code
        className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.92em] text-gray-100 [overflow-wrap:anywhere]"
        {...props}
      >
        {children}
      </code>
    );
  }

  if (language.trim().toLowerCase() === 'mermaid') {
    return (
      <Suspense fallback={<MermaidBlockFallback />}>
        <UniversalChatMermaid source={String(children).replace(/\n$/u, '')} />
      </Suspense>
    );
  }

  if (!rich) {
    return <PlainCodeBlock language={language}>{children}</PlainCodeBlock>;
  }

  return (
    <Suspense fallback={<PlainCodeBlock language={language}>{children}</PlainCodeBlock>}>
      <UniversalChatCodeBlock language={language} className={className} {...props}>
        {children}
      </UniversalChatCodeBlock>
    </Suspense>
  );
}

export function UniversalChatMarkdown({
  content,
  onOpenFile,
  onOpenUrl,
  openFileLabel = 'Open file in editor',
  openUrlLabel = 'Open link preview',
  skills = [],
  mode = 'rich',
  unknownSkillDescription = 'Skill details unavailable',
}: UniversalChatMarkdownProps) {
  const safeLinkComponents = {
    a: ({ node, ...props }: any) => {
      const openFile = onOpenFile;
      const filePath = openFile ? resolveMarkdownFilePath(props.href) : null;
      if (filePath && openFile) {
        return (
          <button
            type="button"
            className="inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-left text-sky-300 hover:text-sky-200 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 [font:inherit] [overflow-wrap:anywhere]"
            data-chat-markdown-file-link="true"
            title={`${openFileLabel}: ${filePath}`}
            aria-label={`${openFileLabel}: ${filePath}`}
            onClick={() => openFile(filePath)}
          >
            <FileCode2
              size={12}
              className="mr-1 inline-block shrink-0 align-[-0.1em] text-sky-400"
              aria-hidden="true"
            />
            <span>{props.children}</span>
          </button>
        );
      }

      const safeHref = resolveSafeMarkdownHref(props.href, {
        allowSkillLinks: true,
      });
      if (!safeHref) {
        return <span>{props.children}</span>;
      }

      if (safeHref.startsWith('skill://')) {
        const skillName = decodeSkillHrefName(safeHref);
        if (!skillName) {
          return <span>{props.children}</span>;
        }
        const skill =
          skills.find((entry) => entry.name.toLowerCase() === skillName.toLowerCase())
          || {
            name: skillName,
            desc: unknownSkillDescription,
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

      if (onOpenUrl && /^https?:\/\//iu.test(safeHref)) {
        return (
          <button
            type="button"
            className="inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-left text-blue-400 hover:text-blue-300 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 [font:inherit] [overflow-wrap:anywhere]"
            data-chat-markdown-url-link="true"
            title={`${openUrlLabel}: ${safeHref}`}
            aria-label={`${openUrlLabel}: ${safeHref}`}
            onClick={() => onOpenUrl(safeHref)}
          >
            {props.children}
          </button>
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
    table: ({ node, children, ...props }: any) => (
      <div
        className="my-3 max-w-full overflow-x-auto rounded-md border border-white/10 custom-scrollbar"
        data-chat-markdown-table="true"
      >
        <table className="m-0 w-full min-w-full border-collapse text-left text-[0.95em]" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-white/[0.045]" {...props} />,
    th: ({ node, ...props }: any) => (
      <th
        className="border-b border-white/10 px-3 py-2 font-semibold text-gray-200 [overflow-wrap:anywhere]"
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td className="border-b border-white/[0.06] px-3 py-2 align-top text-gray-300 [overflow-wrap:anywhere]" {...props} />
    ),
    input: ({ node, ...props }: any) => (
      <input
        {...props}
        disabled
        className="mt-1 h-3.5 w-3.5 shrink-0 accent-blue-500"
      />
    ),
    ul: ({ node, className, ...props }: any) => {
      const isTaskList = typeof className === 'string'
        && className.split(/\s+/u).includes('contains-task-list');
      return (
        <ul
          {...props}
          className={isTaskList
            ? `my-3 flex list-none flex-col gap-1 pl-0 ${className}`
            : className}
        />
      );
    },
    li: ({ node, className, ...props }: any) => {
      const isTaskItem = typeof className === 'string'
        && className.split(/\s+/u).includes('task-list-item');
      return (
        <li
          {...props}
          className={isTaskItem
            ? `my-0 flex list-none items-start gap-2 pl-0 before:hidden marker:hidden ${className}`
            : className}
        />
      );
    },
  };

  if (mode === 'basic') {
    return (
      <ReactMarkdown
        components={{
          ...safeLinkComponents,
          code: ({ node, ...props }: any) => <MarkdownCode {...props} rich={false} />,
          pre: ({ children }: any) => <>{children}</>,
        }}
        remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
      >
        {content}
      </ReactMarkdown>
    );
  }

  const markdownComponents = {
    ...safeLinkComponents,
    code: ({ node, ...props }: any) => <MarkdownCode {...props} rich />,
    pre: ({ children }: any) => <>{children}</>,
  };

  return (
    <ReactMarkdown
      components={markdownComponents}
      remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
    >
      {processContent(content, skills)}
    </ReactMarkdown>
  );
}
