export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shared gate: pauses all workers on 429, enforces minimum spacing. */
export class GlobalRateLimiter {
  private pauseUntil = 0;
  private minSpacingMs = 0;
  private lastRequestAt = 0;
  total429 = 0;
  totalTimeouts = 0;

  async waitForSlot(): Promise<void> {
    while (Date.now() < this.pauseUntil) {
      await sleep(Math.min(250, Math.max(1, this.pauseUntil - Date.now())));
    }
    const gap = Date.now() - this.lastRequestAt;
    if (gap < this.minSpacingMs) {
      await sleep(this.minSpacingMs - gap);
    }
    this.lastRequestAt = Date.now();
  }

  record429(retryAfterSec: number): number {
    this.total429 += 1;
    const pauseMs = (retryAfterSec > 0 ? retryAfterSec + 1 : 50) * 1000;
    this.pauseUntil = Math.max(this.pauseUntil, Date.now() + pauseMs);
    this.minSpacingMs = Math.min(300, this.minSpacingMs + 25);
    return pauseMs;
  }

  recordTimeout(): void {
    this.totalTimeouts += 1;
    this.minSpacingMs = Math.min(200, this.minSpacingMs + 15);
  }

  recordSuccess(): void {
    if (this.minSpacingMs > 0) this.minSpacingMs = Math.max(0, this.minSpacingMs - 2);
  }

  get paused(): boolean {
    return Date.now() < this.pauseUntil;
  }

  pauseRemainingMs(): number {
    return Math.max(0, this.pauseUntil - Date.now());
  }
}

export class AdaptiveConcurrency {
  current: number;
  private last429At = 0;
  private lastIncreaseAt = Date.now();
  private successSince429 = 0;

  constructor(
    readonly min: number,
    start: number,
    readonly max: number,
  ) {
    this.current = start;
  }

  onSuccess(): void {
    this.successSince429 += 1;
    const clean = Date.now() - this.last429At > 90_000;
    const canIncrease = Date.now() - this.lastIncreaseAt > 60_000;
    if (clean && canIncrease && this.successSince429 >= this.current * 3 && this.current < this.max) {
      this.current = Math.min(this.max, this.current + 2);
      this.lastIncreaseAt = Date.now();
      this.successSince429 = 0;
    }
  }

  on429(): void {
    this.last429At = Date.now();
    this.successSince429 = 0;
    this.current = Math.max(this.min, this.current - 4);
  }
}