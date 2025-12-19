/**
 * Token bucket rate limiter for Gong API
 * Gong limits: 3 requests/second, 10,000 requests/day
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 3, refillRate: number = 3) {
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
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate * 1000);
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for Gong API rate limiting
let gongRateLimiter: RateLimiter | null = null;

export function getGongRateLimiter(): RateLimiter {
  if (!gongRateLimiter) {
    gongRateLimiter = new RateLimiter(3, 3); // 3 tokens, refill 3/sec
  }
  return gongRateLimiter;
}

/**
 * Reset the rate limiter (useful for testing)
 */
export function resetGongRateLimiter(): void {
  gongRateLimiter = null;
}
