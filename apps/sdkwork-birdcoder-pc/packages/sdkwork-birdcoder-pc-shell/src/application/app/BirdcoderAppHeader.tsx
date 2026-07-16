/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Code2, X } from 'lucide-react';
import {
  WindowControlMaximizeIcon,
  WindowControlMinimizeIcon,
  WindowControlRestoreIcon,
} from './birdcoderAppWindowControlIcons.tsx';
interface BirdcoderAppHeaderProps {
  centerContent?: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  handleClose(): void;
  handleMaximize(): void;
  handleMinimize(): void;
  isDesktopWindowAvailable: boolean;
  isDesktopWindowMaximized: boolean;
  isDesktopWindowMinimized: boolean;
  leftAddon?: React.ReactNode;
  maximizeButtonRef: React.RefObject<HTMLButtonElement | null>;
  minimizeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onDoubleClick(event: React.MouseEvent<HTMLDivElement>): void;
  onDragStart(event: React.DragEvent<HTMLDivElement>): void;
  onPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onContextMenu(event: React.MouseEvent<HTMLDivElement>): void;
  t: (key: string, options?: Record<string, unknown>) => string;
  titleBarDragSurfaceClass: string;
}

export function BirdcoderAppHeader({
  centerContent,
  closeButtonRef,
  handleClose,
  handleMaximize,
  handleMinimize,
  isDesktopWindowAvailable,
  isDesktopWindowMaximized,
  isDesktopWindowMinimized,
  leftAddon,
  maximizeButtonRef,
  minimizeButtonRef,
  onDoubleClick,
  onDragStart,
  onPointerDown,
  onContextMenu,
  t,
  titleBarDragSurfaceClass,
}: BirdcoderAppHeaderProps) {
  return (
    <div
      className="birdcoder-app-header relative isolate z-[90] grid h-10 w-full shrink-0 select-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-2 touch-none"
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="flex min-w-0 items-center gap-3 h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
        style={{ animationDelay: '0ms' }}
      >
        <div className={`flex h-8 min-w-[148px] items-center gap-2 rounded-lg px-2.5 transition-colors ${titleBarDragSurfaceClass}`}>
          <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Code2 size={12} className="text-white" />
          </div>
          <div className="flex min-w-0 items-center">
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
              BirdCoder
            </span>
          </div>
        </div>

        {leftAddon ? (
          <div
            data-no-drag="true"
            className="flex min-w-0 items-center gap-1"
          >
            {leftAddon}
          </div>
        ) : null}
      </div>

      <div
        className="flex min-w-0 items-center justify-center"
      >
        {centerContent}
      </div>

      <div
        data-no-drag="true"
        className="flex items-center justify-end h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
        style={{ animationDelay: '100ms' }}
      >
        {isDesktopWindowAvailable ? (
          <div className="flex h-full items-center">
            <button
              ref={minimizeButtonRef}
              type="button"
              onClick={handleMinimize}
              aria-label={t('app.menu.minimize')}
              aria-pressed={isDesktopWindowMinimized}
              title={t('app.menu.minimize')}
              className={`h-full px-3 hover:bg-white/10 transition-colors flex items-center justify-center rounded-md ${
                isDesktopWindowMinimized ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'
              }`}
            >
              <WindowControlMinimizeIcon />
            </button>
            <button
              ref={maximizeButtonRef}
              type="button"
              onClick={handleMaximize}
              aria-label={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
              title={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
              className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
            >
              {isDesktopWindowMaximized ? <WindowControlRestoreIcon /> : <WindowControlMaximizeIcon />}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label={t('app.menu.close')}
              title={t('app.menu.close')}
              className="h-full px-3 hover:bg-red-500 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
