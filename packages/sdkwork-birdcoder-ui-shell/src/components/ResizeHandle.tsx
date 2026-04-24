import { useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className = '' }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const onResizeRef = useRef(onResize);
  const pendingDeltaRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const flushPendingResize = () => {
      if (pendingDeltaRef.current === 0) {
        return;
      }

      const delta = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      onResizeRef.current(delta);
    };

    const schedulePendingResizeFlush = () => {
      if (typeof window === 'undefined') {
        flushPendingResize();
        return;
      }

      if (animationFrameRef.current !== null) {
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        flushPendingResize();
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) {
        return;
      }

      pendingDeltaRef.current += direction === 'horizontal' ? event.movementX : event.movementY;
      schedulePendingResizeFlush();
    };

    const handleMouseUp = () => {
      if (animationFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      flushPendingResize();
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      flushPendingResize();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [direction, isDragging]);

  return (
    <div
      className={`shrink-0 z-50 hover:bg-blue-500/50 transition-colors ${
        direction === 'horizontal'
          ? 'w-1 cursor-col-resize hover:w-1.5 -ml-0.5 -mr-0.5'
          : 'h-1 cursor-row-resize hover:h-1.5 -mt-0.5 -mb-0.5'
      } ${className}`}
      onMouseDown={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
    />
  );
}
