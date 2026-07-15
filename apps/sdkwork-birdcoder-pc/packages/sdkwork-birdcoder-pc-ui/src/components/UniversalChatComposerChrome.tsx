import type { ReactNode } from 'react';
import { memo } from 'react';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';

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
    <div className={`relative ${className}`}>
      {onResize ? (
        <div
          className="group/composer-resize absolute inset-x-4 top-0 z-20 h-3 -translate-y-1/2"
          data-testid="universal-chat-composer-resize-hit-area"
        >
          <ResizeHandle
            className="peer absolute inset-0 !m-0 !h-full !w-full !bg-transparent hover:!h-full hover:!bg-transparent"
            direction="vertical"
            onResize={onResize}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/composer-resize:opacity-100 peer-data-[dragging=true]:opacity-100"
            data-testid="universal-chat-composer-resize-indicator"
          >
            <div className="h-0.5 w-12 rounded-full bg-blue-400/75 shadow-[0_0_10px_rgba(96,165,250,0.28)]" />
          </div>
        </div>
      ) : null}
      <div
        className={`flex flex-col gap-2 rounded-[24px] bg-[#29292c] px-4 pb-3 pt-4 shadow-[0_18px_54px_rgba(0,0,0,0.24)] transition-[background-color,box-shadow] duration-200 ${
          isFocused ? 'bg-[#2c2c30] shadow-[0_20px_60px_rgba(0,0,0,0.3)]' : ''
        } ${innerClassName}`}
        style={{ animationDelay: '150ms' }}
      >
        {children}
      </div>
    </div>
  );
});

UniversalChatComposerChrome.displayName = 'UniversalChatComposerChrome';

