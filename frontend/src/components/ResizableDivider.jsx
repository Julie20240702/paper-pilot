import { useCallback, useEffect, useState } from 'react';

function ResizableDivider({
  containerRef,
  onResize,
  minLeft = 30,
  minRight = 25,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback((event) => {
    const container = containerRef?.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const rawLeftPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const maxLeft = 100 - minRight;
    const clampedLeft = Math.min(Math.max(rawLeftPercent, minLeft), maxLeft);

    onResize?.(Number(clampedLeft.toFixed(2)));
  }, [containerRef, minLeft, minRight, onResize]);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  }, [handleMouseMove]);

  const startDragging = (event) => {
    event.preventDefault();
    setIsDragging(true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [handleMouseMove, stopDragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      onDragStart={(event) => event.preventDefault()}
      onMouseDown={startDragging}
      className={`h-full w-1 shrink-0 cursor-col-resize select-none touch-none transition-colors ${
        isDragging ? 'bg-pink-400' : 'bg-gray-200 hover:bg-pink-400'
      }`}
    />
  );
}

export default ResizableDivider;
