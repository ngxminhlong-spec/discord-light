export class Collection<K, V> extends Map<K, V> {
  first(): V | undefined {
    return this.values().next().value;
  }

  firstKey(): K | undefined {
    return this.keys().next().value;
  }

  last(): V | undefined {
    return Array.from(this.values()).pop();
  }

  lastKey(): K | undefined {
    return Array.from(this.keys()).pop();
  }

  filter(predicate: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const results = new Collection<K, V>();
    for (const [key, value] of this) {
      if (predicate(value, key, this)) results.set(key, value);
    }
    return results;
  }

  map<T>(mapper: (value: V, key: K, collection: this) => T): T[] {
    const results: T[] = [];
    for (const [key, value] of this) {
      results.push(mapper(value, key, this));
    }
    return results;
  }

  find(predicate: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, value] of this) {
      if (predicate(value, key, this)) return value;
    }
    return undefined;
  }

  some(predicate: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (predicate(value, key, this)) return true;
    }
    return false;
  }

  every(predicate: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (!predicate(value, key, this)) return false;
    }
    return true;
  }

  sort(compareFunction: (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number): Collection<K, V> {
    const entries = Array.from(this.entries());
    entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
    return new Collection(entries);
  }

  toArray(): V[] {
    return Array.from(this.values());
  }

  random(): V | undefined {
    const arr = this.toArray();
    return arr[Math.floor(Math.random() * arr.length)];
  }

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

  sweepByTTL<T extends { createdTimestamp: number }>(
    this: Collection<K, T>,
    maxAgeMs: number,
    now = Date.now()
  ): number {
    return this.sweep((value) => now - value.createdTimestamp > maxAgeMs);
  }
}
