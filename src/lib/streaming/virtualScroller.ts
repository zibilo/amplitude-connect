/**
 * Virtual Scrolling Configuration for TanStack Virtual
 * Optimized for displaying millions of payroll entries
 */

export interface VirtualScrollConfig {
  itemHeight: number;
  overscan: number;
  estimateSize: (index: number) => number;
}

export const DEFAULT_VIRTUAL_CONFIG: VirtualScrollConfig = {
  itemHeight: 48, // Standard row height in pixels
  overscan: 10, // Number of items to render outside visible area
  estimateSize: () => 48
};

export const COMPACT_VIRTUAL_CONFIG: VirtualScrollConfig = {
  itemHeight: 36,
  overscan: 15,
  estimateSize: () => 36
};

/**
 * Calculate optimal chunk size based on data volume
 */
export function calculateChunkSize(totalRows: number): number {
  if (totalRows < 1000) return 100;
  if (totalRows < 10000) return 500;
  if (totalRows < 100000) return 1000;
  return 2000;
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
