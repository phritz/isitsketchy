const MS_PER_MINUTE: number = 60_000;

// Abstraction over time so the limiter is deterministically testable.
// Real callers pass `systemClock`; tests pass a controllable clock.
export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export const systemClock: Clock = {
  now: (): number => Date.now(),
  sleep: (ms: number): Promise<void> =>
    new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, ms);
    }),
};

export type RateLimiterOptions = {
  limitPerMinute: number;
  name: string;
  clock: Clock;
};

// Token-bucket limiter with lazy refill. Single-process, in-memory.
// - Bursts up to `limitPerMinute`, then paces at that rate.
// - `tryAcquire()` is non-blocking; `acquire()` waits for a free slot.
export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly limitName: string;
  private readonly clock: Clock;
  private tokens: number;
  private lastRefillMs: number;
  private tail: Promise<void>;

  constructor(options: RateLimiterOptions) {
    if (options.limitPerMinute <= 0) {
      throw new Error(
        `RateLimiter "${options.name}": limitPerMinute must be > 0, got ${options.limitPerMinute}`,
      );
    }

    this.capacity = options.limitPerMinute;
    this.refillPerMs = options.limitPerMinute / MS_PER_MINUTE;
    this.limitName = options.name;
    this.clock = options.clock;
    this.tokens = this.capacity;
    this.lastRefillMs = options.clock.now();
    this.tail = Promise.resolve();
  }

  get name(): string {
    return this.limitName;
  }

  availableTokens(): number {
    this.refill();
    return this.tokens;
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  acquire(): Promise<void> {
    // Chain each caller onto a queue so concurrent acquires resolve in order
    // and never double-spend the same token.
    const result: Promise<void> = this.tail.then(
      (): Promise<void> => this.waitForToken(),
    );
    this.tail = result.then(
      (): void => undefined,
      (): void => undefined,
    );
    return result;
  }

  private refill(): void {
    const now: number = this.clock.now();
    const elapsed: number = now - this.lastRefillMs;
    if (elapsed <= 0) {
      return;
    }
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = now;
  }

  private async waitForToken(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const deficit: number = 1 - this.tokens;
      const waitMs: number = Math.ceil(deficit / this.refillPerMs);
      await this.clock.sleep(waitMs);
      this.refill();
    }
    this.tokens -= 1;
  }
}
