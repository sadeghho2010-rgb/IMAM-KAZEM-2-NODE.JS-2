import { logger } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before tripping (default: 4)
  resetTimeoutMs?: number;   // Time in ms before entering HALF_OPEN (default: 10000ms)
}

export class DatabaseCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold || 4;
    this.resetTimeoutMs = options?.resetTimeoutMs || 10000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        logger.warn('[CircuitBreaker] Database circuit entered HALF_OPEN state. Probing connection...');
      }
    }
    return this.state;
  }

  public async execute<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T
  ): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      logger.warn('[CircuitBreaker] Circuit is OPEN. Fast-failing to offline fallback storage.');
      return fallback();
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      logger.warn(`[CircuitBreaker] Operation failed. Delegating to fallback. Error: ${error?.message || error}`);
      return fallback();
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      logger.info('[CircuitBreaker] Probe succeeded. Resetting database circuit to CLOSED (healthy).');
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  private onFailure(error: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.error(`[CircuitBreaker] Database circuit TRIPPED to OPEN (${this.failureCount} failures). Backing off for ${this.resetTimeoutMs}ms.`, {
        error: error?.message || error
      });
    }
  }

  public getStatus() {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      isHealthy: this.getState() === 'CLOSED'
    };
  }
}

export const dbCircuitBreaker = new DatabaseCircuitBreaker();
