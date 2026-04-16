import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

export interface UniversalChatCodeBlockProps extends Record<string, unknown> {
  language: string;
  className?: string;
  children: React.ReactNode;
}

const LANGUAGE_ALIASES = new Map<string, string>([
  ['bash', 'bash'],
  ['sh', 'bash'],
  ['shell', 'bash'],
  ['shell-session', 'bash'],
  ['diff', 'diff'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['json', 'json'],
  ['jsx', 'jsx'],
  ['markdown', 'markdown'],
  ['md', 'markdown'],
  ['markup', 'markup'],
  ['html', 'markup'],
  ['xml', 'markup'],
  ['python', 'python'],
  ['py', 'python'],
  ['rust', 'rust'],
  ['rs', 'rust'],
  ['sql', 'sql'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['tsx', 'tsx'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
]);

const LANGUAGE_REGISTRATIONS = [
  ['bash', bash],
  ['diff', diff],
  ['javascript', javascript],
  ['json', json],
  ['jsx', jsx],
  ['markdown', markdown],
  ['markup', markup],
  ['python', python],
  ['rust', rust],
  ['sql', sql],
  ['tsx', tsx],
  ['typescript', typescript],
  ['yaml', yaml],
] as const;

let languagesRegistered = false;

function ensureLanguagesRegistered() {
  if (languagesRegistered) {
    return;
  }

  for (const [name, language] of LANGUAGE_REGISTRATIONS) {
    SyntaxHighlighter.registerLanguage(name, language);
  }

  languagesRegistered = true;
}

function resolveLanguage(language: string) {
  return LANGUAGE_ALIASES.get(language.trim().toLowerCase()) ?? 'markup';
}

export function UniversalChatCodeBlock({
  language,
  children,
  className,
  ...props
}: UniversalChatCodeBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  ensureLanguagesRegistered();

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code rounded-xl overflow-hidden border border-white/10 my-4 bg-[#0d0d0d] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs font-mono text-gray-400">{language || 'text'}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors opacity-0 group-hover/code:opacity-100"
            onClick={handleCopy}
            title={t('chat.copyCode')}
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar text-[13px] leading-relaxed font-mono">
        <SyntaxHighlighter
          language={resolveLanguage(language || 'text')}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '13px',
          }}
          className={className}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
