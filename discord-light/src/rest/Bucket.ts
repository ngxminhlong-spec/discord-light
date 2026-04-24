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
      void this.#process();
    }
  }

  async #process(): Promise<void> {
    while (this.#queue.length > 0) {
      const request = this.#queue[0];

      // Check global rate limit
      const now = Date.now();
      if (this.#globalReset > now) {
        const wait = this.#globalReset - now;
        this.#logger.debug('Bucket %s waiting %dms for global rate limit', this.#id, wait);
        await sleep(wait);
      }

      // Check bucket rate limit
      if (this.#rateLimit && this.#rateLimit.remaining <= 0 && this.#rateLimit.reset > now) {
        const wait = this.#rateLimit.reset - now + 50; // 50ms buffer
        this.#logger.debug('Bucket %s waiting %dms for bucket rate limit', this.#id, wait);
        await sleep(wait);
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
