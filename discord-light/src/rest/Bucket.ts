import type { Logger } from '../utils/Logger.js';

export interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  execute: () => Promise<unknown>;
  retries: number;
}

export interface RateLimitData {
  limit: number;
  remaining: number;
  reset: number;
  resetAfter: number;
  bucket: string;
}

export class Bucket {
  #id: string;
  #logger: Logger;
  #queue: QueuedRequest[] = [];
  #processing = false;
  #rateLimit: RateLimitData | null = null;
  #globalReset = 0;
  #processTimer: NodeJS.Timeout | NodeJS.Immediate | null = null;

  constructor(id: string, logger: Logger) {
    this.#id = id;
    this.#logger = logger;
  }

  get id(): string {
    return this.#id;
  }

  get size(): number {
    return this.#queue.length;
  }

  get rateLimit(): RateLimitData | null {
    return this.#rateLimit;
  }

  setGlobalReset(timestamp: number): void {
    this.#globalReset = timestamp;
  }

  updateRateLimit(data: RateLimitData): void {
    this.#rateLimit = data;
  }

  add(request: QueuedRequest): void {
    this.#queue.push(request);
    if (!this.#processing) {
      this.#processing = true;
      void this.#scheduleProcess();
    }
  }

  /**
   * Schedule processing instead of running immediately
   * Allows batching of requests and reduces event loop pressure
   */
  #scheduleProcess(): void {
    if (this.#processTimer) return;
    this.#processTimer = setImmediate(() => {
      this.#processTimer = null;
      void this.#process();
    });
  }

  async #process(): Promise<void> {
    while (this.#queue.length > 0) {
      const request = this.#queue[0];
      const now = Date.now();

      // Check global rate limit
      if (this.#globalReset > now) {
        const wait = this.#globalReset - now;
        this.#logger.debug('Bucket %s waiting %dms for global rate limit', this.#id, wait);
        await sleep(wait);
        continue; // Re-check after waiting
      }

      // Check bucket rate limit
      if (this.#rateLimit && this.#rateLimit.remaining <= 0) {
        const resetTime = this.#rateLimit.reset > now ? this.#rateLimit.reset : now;
        const wait = resetTime - now + 50; // 50ms buffer
        this.#logger.debug('Bucket %s waiting %dms for bucket rate limit', this.#id, wait);
        await sleep(wait);
        continue; // Re-check after waiting
      }

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (err) {
        request.reject(err as Error);
      }

      this.#queue.shift();
    }

    this.#processing = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
