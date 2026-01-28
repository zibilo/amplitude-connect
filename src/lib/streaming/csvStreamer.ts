/**
 * CSV Streaming Parser using PapaParse with Web Workers
 * Enables non-blocking parsing of massive files
 */

import Papa from 'papaparse';

export interface StreamingProgress {
  rowsParsed: number;
  bytesProcessed: number;
  totalBytes: number;
  percentComplete: number;
  currentChunk: number;
}

export interface StreamingResult<T> {
  data: T[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
}

export type ProgressCallback = (progress: StreamingProgress) => void;
export type ChunkCallback<T> = (chunk: T[], chunkIndex: number) => Promise<void> | void;

/**
 * Stream parse a CSV file with progress updates
 */
export async function streamParseCSV<T = Record<string, unknown>>(
  file: File,
  options: {
    onProgress?: ProgressCallback;
    onChunk?: ChunkCallback<T>;
    chunkSize?: number;
    header?: boolean;
    dynamicTyping?: boolean;
    skipEmptyLines?: boolean;
  } = {}
): Promise<StreamingResult<T>> {
  const {
    onProgress,
    onChunk,
    chunkSize = 1000,
    header = true,
    dynamicTyping = true,
    skipEmptyLines = true
  } = options;

  return new Promise((resolve, reject) => {
    const allData: T[] = [];
    const allErrors: Papa.ParseError[] = [];
    let meta: Papa.ParseMeta | undefined;
    let rowsParsed = 0;
    let chunkIndex = 0;

    Papa.parse<T>(file, {
      worker: true,
      header,
      dynamicTyping,
      skipEmptyLines,
      chunkSize: chunkSize * 1024, // Convert to bytes
      
      chunk: async (results, parser) => {
        chunkIndex++;
        rowsParsed += results.data.length;
        
        // Report progress
        if (onProgress) {
          onProgress({
            rowsParsed,
            bytesProcessed: results.meta.cursor,
            totalBytes: file.size,
            percentComplete: Math.round((results.meta.cursor / file.size) * 100),
            currentChunk: chunkIndex
          });
        }

        // Process chunk
        if (onChunk) {
          parser.pause();
          try {
            await onChunk(results.data, chunkIndex);
          } catch (error) {
            console.error('Chunk processing error:', error);
          }
          parser.resume();
        }

        allData.push(...results.data);
        allErrors.push(...results.errors);
        meta = results.meta;
      },

      complete: () => {
        resolve({
          data: allData,
          errors: allErrors,
          meta: meta!
        });
      },

      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Quick preview of CSV file (first N rows)
 */
export async function previewCSV<T = Record<string, unknown>>(
  file: File,
  rowCount: number = 100
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const preview: T[] = [];
    
    Papa.parse<T>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      preview: rowCount,
      
      complete: (results) => {
        resolve(results.data);
      },
      
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Detect CSV delimiter automatically
 */
export async function detectDelimiter(file: File): Promise<string> {
  const sample = file.slice(0, 10000);
  const text = await sample.text();
  
  const delimiters = [',', ';', '\t', '|'];
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (text.match(new RegExp(d, 'g')) || []).length
  }));
  
  counts.sort((a, b) => b.count - a.count);
  return counts[0].delimiter;
}
