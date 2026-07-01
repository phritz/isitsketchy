import { describe, it, expect } from "vitest";
import { Clock, RateLimiter } from "./rate-limiter";

// Deterministic clock: time only moves when the test calls `advance`, which
// also resolves any `sleep`s that have come due (flushing microtasks so the
// awaiting code can register its next sleep).
class ManualClock implements Clock {
  private current: number;
  private timers: { at: number; resolve: () => void }[];

  constructor(start: number) {
    this.current = start;
    this.timers = [];
  }

  now = (): number => this.current;

  sleep = (ms: number): Promise<void> =>
    new Promise<void>((resolve: () => void): void => {
      this.timers.push({ at: this.current + ms, resolve });
    });

  async advance(ms: number): Promise<void> {
    this.current += ms;
    while (true) {
      await Promise.resolve();
      const index: number = this.earliestDueIndex();
      if (index === -1) {
        break;
      }
      const [timer] = this.timers.splice(index, 1);
      timer.resolve();
    }
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  private earliestDueIndex(): number {
    let earliest: number = -1;
    for (let i = 0; i < this.timers.length; i++) {
      if (this.timers[i].at <= this.current) {
        if (earliest === -1 || this.timers[i].at < this.timers[earliest].at) {
          earliest = i;
        }
      }
    }
    return earliest;
  }
}

describe("RateLimiter", () => {
  it("exposes its name", () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 60,
      name: "github-search",
      clock,
    });
    expect(limiter.name).toBe("github-search");
  });

  it("rejects a non-positive limit", () => {
    const clock = new ManualClock(0);
    expect(
      () =>
        new RateLimiter({ limitPerMinute: 0, name: "bad", clock }),
    ).toThrow(/limitPerMinute/);
  });

  it("allows exactly `limitPerMinute` immediate tryAcquire calls, then blocks", () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 5,
      name: "t",
      clock,
    });
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);
  });

  it("refills proportionally to elapsed time and caps at capacity", () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 60,
      name: "t",
      clock,
    });
    for (let i = 0; i < 60; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.availableTokens()).toBeCloseTo(0, 6);

    // 60/min => 1 token per 1000ms.
    clock.advance(3000);
    expect(limiter.availableTokens()).toBeCloseTo(3, 6);

    // Never exceeds capacity even after a long idle period.
    clock.advance(10 * 60_000);
    expect(limiter.availableTokens()).toBeCloseTo(60, 6);
  });

  it("acquire resolves immediately when a token is available", async () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 60,
      name: "t",
      clock,
    });
    await limiter.acquire();
    expect(limiter.availableTokens()).toBeCloseTo(59, 6);
  });

  it("acquire waits until the bucket refills when empty", async () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 60,
      name: "t",
      clock,
    });
    for (let i = 0; i < 60; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }

    let resolved = false;
    const pending: Promise<void> = limiter.acquire().then((): void => {
      resolved = true;
    });

    await clock.advance(500);
    expect(resolved).toBe(false);

    await clock.advance(500); // 1000ms total => one token
    await pending;
    expect(resolved).toBe(true);
  });

  it("resolves concurrent acquires in call order without double-spending", async () => {
    const clock = new ManualClock(0);
    const limiter = new RateLimiter({
      limitPerMinute: 60,
      name: "t",
      clock,
    });
    for (let i = 0; i < 60; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }

    const order: number[] = [];
    const p1: Promise<void> = limiter.acquire().then((): void => {
      order.push(1);
    });
    const p2: Promise<void> = limiter.acquire().then((): void => {
      order.push(2);
    });
    const p3: Promise<void> = limiter.acquire().then((): void => {
      order.push(3);
    });

    // One token becomes available: only the first waiter proceeds.
    await clock.advance(1000);
    await p1;
    expect(order).toEqual([1]);

    await clock.advance(2000); // two more tokens
    await Promise.all([p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });
});
