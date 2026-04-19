import React, { useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className = '' }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (direction === 'horizontal') {
        onResizeRef.current(e.movementX);
      } else {
        onResizeRef.current(e.movementY);
      }
    };

    const handleMouseUp = () => {
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
