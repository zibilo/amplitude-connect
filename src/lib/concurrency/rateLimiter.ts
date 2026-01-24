/**
 * MUCO-AMPLITUDE: Rate Limiter & Concurrency Control
 * Contrôle du nombre d'opérations simultanées avec p-limit
 */

import pLimit from 'p-limit';

// Limite par défaut pour les opérations de base de données
const DEFAULT_DB_CONCURRENCY = 5;

// Limite pour les opérations réseau (Oracle, API externes)
const DEFAULT_NETWORK_CONCURRENCY = 3;

// Limite pour les opérations de fichiers
const DEFAULT_FILE_CONCURRENCY = 2;

/**
 * Créer un limiteur de concurrence pour les opérations DB
 */
export function createDbLimiter(concurrency: number = DEFAULT_DB_CONCURRENCY) {
  return pLimit(concurrency);
}

/**
 * Créer un limiteur de concurrence pour les opérations réseau
 */
export function createNetworkLimiter(concurrency: number = DEFAULT_NETWORK_CONCURRENCY) {
  return pLimit(concurrency);
}

/**
 * Créer un limiteur de concurrence pour les opérations fichier
 */
export function createFileLimiter(concurrency: number = DEFAULT_FILE_CONCURRENCY) {
  return pLimit(concurrency);
}

/**
 * Limiteurs globaux de l'application
 */
export const globalLimiters = {
  db: createDbLimiter(),
  network: createNetworkLimiter(),
  file: createFileLimiter()
};

/**
 * Circuit Breaker pour la gestion des erreurs réseau
 * Se déclenche après N échecs consécutifs
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private isOpen: boolean = false;
  
  constructor(
    private readonly maxFailures: number = 3,
    private readonly resetTimeoutMs: number = 30000
  ) {}
  
  /**
   * Vérifier si le circuit est ouvert (en erreur)
   */
  isCircuitOpen(): boolean {
    if (!this.isOpen) return false;
    
    // Vérifier si le timeout de reset est passé
    const now = Date.now();
    if (now - this.lastFailureTime > this.resetTimeoutMs) {
      this.reset();
      return false;
    }
    
    return true;
  }
  
  /**
   * Enregistrer un succès
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.isOpen = false;
  }
  
  /**
   * Enregistrer un échec
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.maxFailures) {
      this.isOpen = true;
    }
  }
  
  /**
   * Réinitialiser le circuit
   */
  reset(): void {
    this.failureCount = 0;
    this.isOpen = false;
  }
  
  /**
   * Obtenir l'état du circuit
   */
  getState(): {
    isOpen: boolean;
    failureCount: number;
    timeSinceLastFailure: number;
  } {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : 0
    };
  }
}

/**
 * Retry avec backoff exponentiel
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Timeout wrapper pour les opérations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Opération timeout'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Batch executor avec contrôle de concurrence
 */
export async function executeBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R>,
  concurrency: number = 3
): Promise<R[]> {
  const limit = pLimit(concurrency);
  const batches: T[][] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  return Promise.all(
    batches.map(batch => limit(() => processor(batch)))
  );
}

/**
 * Queue pour les opérations séquentielles
 */
export class OperationQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;
  
  /**
   * Ajouter une opération à la queue
   */
  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      
      this.processQueue();
    });
  }
  
  /**
   * Traiter la queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        await operation();
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Obtenir la taille de la queue
   */
  get size(): number {
    return this.queue.length;
  }
  
  /**
   * Vider la queue
   */
  clear(): void {
    this.queue = [];
  }
}

// Instance globale du circuit breaker pour Oracle
export const oracleCircuitBreaker = new CircuitBreaker(3, 30000);

// Queue globale pour les opérations critiques
export const criticalOperationQueue = new OperationQueue();
