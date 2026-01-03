/**
 * Token bucket rate limiter for People Data Labs API
 * PDL limits: 100/min (free), 1000/min (paid)
 *
 * Reuses the same pattern as the Hunter rate limiter for consistency.
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 1, refillRate: number = 0.5) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   * Returns a promise that resolves when a token is available
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time until next token is available
    const waitTime = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
    await this.sleep(waitTime);

    // Refill and try again
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Try to acquire a token without waiting
   * Returns true if successful, false if no tokens available
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get current available tokens (for debugging/monitoring)
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for PDL API rate limiting
let pdlRateLimiter: RateLimiter | null = null;

export function getPdlRateLimiter(): RateLimiter {
  if (!pdlRateLimiter) {
    // PDL: 100 requests/minute (free) = ~1.67 requests/second
    // We use conservative 1 token max with 1/sec refill for safety
    pdlRateLimiter = new RateLimiter(1, 1);
  }
  return pdlRateLimiter;
}

/**
 * Reset the rate limiter (useful for testing)
 */
export function resetPdlRateLimiter(): void {
  pdlRateLimiter = null;
}
