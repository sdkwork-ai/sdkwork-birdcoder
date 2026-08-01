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
    <div className={`relative ${className}`} data-chat-composer-chrome="true">
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
        className={`composer-surface-chrome flex flex-col gap-1.5 rounded-[20px] border border-white/[0.07] bg-[#242426]/90 px-3 pb-2 pt-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-lg transition-[background-color,border-color,box-shadow] duration-200 ${
          isFocused
            ? 'border-white/[0.11] bg-[#27272a]/95 shadow-[0_10px_28px_rgba(0,0,0,0.22)]'
            : ''
        } ${innerClassName}`}
        style={{ animationDelay: '150ms' }}
      >
        {children}
      </div>
    </div>
  );
});

UniversalChatComposerChrome.displayName = 'UniversalChatComposerChrome';

