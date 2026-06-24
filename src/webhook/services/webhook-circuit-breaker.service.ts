import { Injectable, Logger } from '@nestjs/common';

interface CircuitEntry {
  failures: number;
  openUntil: number;
}

@Injectable()
export class WebhookCircuitBreaker {
  private readonly logger = new Logger(WebhookCircuitBreaker.name);
  private readonly store = new Map<string, CircuitEntry>();
  private thresholdValue = 5;
  private cooldownValue = 30000;

  private enabled = false;

  enable(threshold?: number, cooldownMs?: number): void {
    this.enabled = true;
    this.thresholdValue = threshold ?? 5;
    this.cooldownValue = cooldownMs ?? 30000;
  }

  isOpen(url: string): boolean {
    if (!this.enabled) return false;
    const entry = this.store.get(url);
    if (!entry || entry.openUntil === 0) return false;
    if (Date.now() > entry.openUntil) {
      this.store.delete(url);
      return false;
    }
    return true;
  }

  recordSuccess(url: string): void {
    this.store.delete(url);
  }

  recordFailure(url: string, threshold?: number, cooldownMs?: number): void {
    if (!this.enabled) return;
    const entry = this.store.get(url) ?? { failures: 0, openUntil: 0 };
    entry.failures++;
    if (entry.failures >= (threshold ?? this.thresholdValue)) {
      entry.openUntil = Date.now() + (cooldownMs ?? this.cooldownValue);
      this.logger.warn(
        `Circuit breaker opened for ${url} (${entry.failures} failures, cooldown ${this.cooldownValue}ms)`,
      );
    }
    this.store.set(url, entry);
  }

  reset(): void {
    this.store.clear();
  }
}
