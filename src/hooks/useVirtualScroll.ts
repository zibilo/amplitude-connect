import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface UseVirtualScrollOptions<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
}

export function useVirtualScroll<T>({
  items,
  estimateSize = 48,
  overscan = 10
}: UseVirtualScrollOptions<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const scrollToIndex = useCallback((index: number) => {
    virtualizer.scrollToIndex(index, { align: 'center' });
  }, [virtualizer]);

  const scrollToTop = useCallback(() => {
    virtualizer.scrollToOffset(0);
  }, [virtualizer]);

  return {
    parentRef,
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToTop,
    measureElement: virtualizer.measureElement
  };
}
