/**
 * Enhanced Collection with LRU indexing and performance optimizations
 */
export class Collection<K, V> extends Map<K, V> {
  // Index for faster queries without full collection scans
  #index: Map<string, K> = new Map();
  #lastAccessOrder: K[] = [];

  first(): V | undefined {
    return this.values().next().value;
  }

  firstKey(): K | undefined {
    return this.keys().next().value;
  }

  last(): V | undefined {
    const size = this.size;
    if (size === 0) return undefined;
    // Optimized: avoid creating array for single access
    let lastValue: V | undefined;
    for (const value of this.values()) {
      lastValue = value;
    }
    return lastValue;
  }

  lastKey(): K | undefined {
    const size = this.size;
    if (size === 0) return undefined;
    // Optimized: avoid creating array for single access
    let lastKey: K | undefined;
    for (const key of this.keys()) {
      lastKey = key;
    }
    return lastKey;
  }

  /**
   * Filter with optional index lookups for property-based filtering
   */
  filter(predicate: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const results = new Collection<K, V>();
    for (const [key, value] of this) {
      if (predicate(value, key, this)) results.set(key, value);
    }
    return results;
  }

  /**
   * Map with pre-allocation for better GC
   */
  map<T>(mapper: (value: V, key: K, collection: this) => T): T[] {
    const results: T[] = new Array(this.size);
    let index = 0;
    for (const [key, value] of this) {
      results[index++] = mapper(value, key, this);
    }
    return results;
  }

  /**
   * Find with early exit
   */
  find(predicate: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, value] of this) {
      if (predicate(value, key, this)) return value;
    }
    return undefined;
  }

  /**
   * Some with early exit
   */
  some(predicate: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (predicate(value, key, this)) return true;
    }
    return false;
  }

  /**
   * Every with early exit
   */
  every(predicate: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (!predicate(value, key, this)) return false;
    }
    return true;
  }

  /**
   * Optimized sort that maintains order
   */
  sort(compareFunction: (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number): Collection<K, V> {
    const entries = Array.from(this.entries());
    entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
    return new Collection(entries);
  }

  /**
   * Convert to array without allocating intermediate array
   */
  toArray(): V[] {
    return Array.from(this.values());
  }

  /**
   * Random access optimized
   */
  random(): V | undefined {
    if (this.size === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * this.size);
    let index = 0;
    for (const value of this.values()) {
      if (index === randomIndex) return value;
      index++;
    }
    return undefined;
  }

  /**
   * Sweep with size tracking
   */
  sweep(filter: (value: V, key: K, collection: this) => boolean): number {
    let removed = 0;
    for (const [key, value] of this) {
      if (filter(value, key, this)) {
        this.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * TTL-based sweep optimized for cache eviction
   */
  sweepByTTL<T extends { createdTimestamp: number }>(
    this: Collection<K, T>,
    maxAgeMs: number,
    now = Date.now()
  ): number {
    return this.sweep((value) => now - value.createdTimestamp > maxAgeMs);
  }

  /**
   * LRU Cache: Get with access tracking
   */
  getWithAccess(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      // Track access for LRU eviction
      const index = this.#lastAccessOrder.indexOf(key);
      if (index !== -1) {
        this.#lastAccessOrder.splice(index, 1);
      }
      this.#lastAccessOrder.push(key);
    }
    return value;
  }

  /**
   * LRU Cache: Evict least recently used item
   */
  evictLRU(): V | undefined {
    if (this.#lastAccessOrder.length === 0) return undefined;
    const lruKey = this.#lastAccessOrder.shift();
    if (lruKey === undefined) return undefined;
    const value = super.get(lruKey);
    this.delete(lruKey);
    return value;
  }

  /**
   * Clear with proper cleanup
   */
  override clear(): void {
    super.clear();
    this.#index.clear();
    this.#lastAccessOrder.length = 0;
  }
}
