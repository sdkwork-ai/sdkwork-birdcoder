import React, { useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className = '' }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const onResizeRef = useRef(onResize);
  const animationFrameRef = useRef(0);
  const pendingDeltaRef = useRef(0);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const flushPendingResize = () => {
      if (pendingDeltaRef.current === 0) {
        return;
      }

      const nextDelta = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      onResizeRef.current(nextDelta);
    };

    const cancelScheduledResize = () => {
      if (animationFrameRef.current === 0 || typeof window === 'undefined') {
        return;
      }

      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    };

    const scheduleResizeFlush = () => {
      if (typeof window === 'undefined') {
        flushPendingResize();
        return;
      }

      if (animationFrameRef.current !== 0) {
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = 0;
        flushPendingResize();
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      pendingDeltaRef.current += direction === 'horizontal' ? e.movementX : e.movementY;
      scheduleResizeFlush();
    };

    const handleMouseUp = () => {
      cancelScheduledResize();
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
      cancelScheduledResize();
      flushPendingResize();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction]);

  return (
    <div
      className={`shrink-0 z-50 hover:bg-blue-500/50 transition-colors ${
        direction === 'horizontal' 
          ? 'w-1 cursor-col-resize hover:w-1.5 -ml-0.5 -mr-0.5' 
          : 'h-1 cursor-row-resize hover:h-1.5 -mt-0.5 -mb-0.5'
      } ${className}`}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
    />
  );
}
