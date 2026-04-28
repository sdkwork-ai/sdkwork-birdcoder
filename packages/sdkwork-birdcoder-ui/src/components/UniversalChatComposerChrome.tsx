import type { ReactNode } from 'react';
import { memo } from 'react';
import { ResizeHandle } from '@sdkwork/birdcoder-ui-shell';

export interface UniversalChatComposerChromeProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  isFocused?: boolean;
  onResize?: (delta: number) => void;
}

export const UniversalChatComposerChrome = memo(function UniversalChatComposerChrome({
  children,
  className = '',
  innerClassName = '',
  isFocused = false,
  onResize,
}: UniversalChatComposerChromeProps) {
  return (
    <div className={`group/composer relative ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center opacity-0 transition-opacity duration-150 group-hover/composer:opacity-100 group-focus-within/composer:opacity-100">
        <div className="mt-[1px] h-1 w-16 rounded-full bg-blue-400/55 shadow-[0_0_14px_rgba(96,165,250,0.35)]" />
      </div>
      {onResize ? (
        <ResizeHandle
          className="absolute left-4 right-4 top-0 z-20 bg-transparent opacity-0 transition-opacity duration-150 hover:bg-blue-400/75 group-hover/composer:opacity-100 group-focus-within/composer:opacity-100"
          direction="vertical"
          onResize={onResize}
        />
      ) : null}
      <div
        className={`flex flex-col gap-2 rounded-2xl border bg-[#18181b]/88 p-3 shadow-lg backdrop-blur-xl transition-all duration-300 ${
          isFocused ? 'border-white/20 shadow-white/5' : 'border-white/10'
        } ${innerClassName}`}
        style={{ animationDelay: '150ms' }}
      >
        {children}
      </div>
    </div>
  );
});

UniversalChatComposerChrome.displayName = 'UniversalChatComposerChrome';
