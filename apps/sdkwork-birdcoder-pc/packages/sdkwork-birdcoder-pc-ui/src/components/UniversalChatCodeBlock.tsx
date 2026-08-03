/// <reference path="../react-syntax-highlighter.d.ts" />

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { useBirdcoderTheme } from '@sdkwork/birdcoder-pc-workbench/theme/birdcoderTheme';
import { copyTextToClipboard } from './clipboard';

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
  ['c', 'c'],
  ['cpp', 'cpp'],
  ['c++', 'cpp'],
  ['csharp', 'csharp'],
  ['cs', 'csharp'],
  ['css', 'css'],
  ['diff', 'diff'],
  ['go', 'go'],
  ['golang', 'go'],
  ['java', 'java'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['json', 'json'],
  ['jsx', 'jsx'],
  ['kotlin', 'kotlin'],
  ['kt', 'kotlin'],
  ['markdown', 'markdown'],
  ['md', 'markdown'],
  ['markup', 'markup'],
  ['html', 'markup'],
  ['xml', 'markup'],
  ['php', 'php'],
  ['powershell', 'powershell'],
  ['ps1', 'powershell'],
  ['python', 'python'],
  ['py', 'python'],
  ['ruby', 'ruby'],
  ['rb', 'ruby'],
  ['rust', 'rust'],
  ['rs', 'rust'],
  ['sql', 'sql'],
  ['swift', 'swift'],
  ['toml', 'toml'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['tsx', 'tsx'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
]);

const LANGUAGE_REGISTRATIONS = [
  ['bash', bash],
  ['c', c],
  ['cpp', cpp],
  ['csharp', csharp],
  ['css', css],
  ['diff', diff],
  ['go', go],
  ['java', java],
  ['javascript', javascript],
  ['json', json],
  ['jsx', jsx],
  ['kotlin', kotlin],
  ['markdown', markdown],
  ['markup', markup],
  ['php', php],
  ['powershell', powershell],
  ['python', python],
  ['ruby', ruby],
  ['rust', rust],
  ['sql', sql],
  ['swift', swift],
  ['toml', toml],
  ['tsx', tsx],
  ['typescript', typescript],
  ['yaml', yaml],
] as const;

let languagesRegistered = false;

const SyntaxHighlighterComponent = SyntaxHighlighter as React.ComponentType<
  React.ComponentProps<typeof SyntaxHighlighter>
>;

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
  const { colorMode } = useBirdcoderTheme();
  const [copied, setCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  ensureLanguagesRegistered();

  const handleCopy = async () => {
    const didCopy = await copyTextToClipboard(String(children).replace(/\n$/, ''));
    if (!didCopy) {
      return;
    }

    setCopied(true);
    clearCopyFeedbackTimeout();
    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copyFeedbackTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => () => {
    clearCopyFeedbackTimeout();
  }, [clearCopyFeedbackTimeout]);

  return (
    <div className="relative group/code my-3 max-w-full overflow-hidden rounded-md border border-white/10 bg-[#0d0d0d]">
      <div className="flex min-h-8 items-center justify-between border-b border-white/5 bg-white/[0.035] px-3 py-1.5">
        <span className="font-mono text-[11px] text-gray-500">{language || 'text'}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md text-gray-500 opacity-0 transition-colors hover:bg-white/10 hover:text-gray-300 group-hover/code:opacity-100 group-focus-within/code:opacity-100 [@media(hover:none)]:opacity-100"
            onClick={handleCopy}
            title={t('chat.copyCode')}
            aria-label={t('chat.copyCode')}
          >
            {copied
              ? <Check size={12} className="text-emerald-400" aria-hidden="true" />
              : <Copy size={12} aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar text-[13px] leading-relaxed font-mono">
        <SyntaxHighlighterComponent
          language={resolveLanguage(language || 'text')}
          style={colorMode === 'dark' ? vscDarkPlus : oneLight}
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
        </SyntaxHighlighterComponent>
      </div>
    </div>
  );
}

