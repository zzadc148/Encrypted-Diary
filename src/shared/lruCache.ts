export class LruCache<K, V> {
  private readonly maxSize: number;

  private readonly entries = new Map<K, V>();

  public constructor(maxSize: number) {
    this.maxSize = Math.max(1, maxSize);
  }

  public get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  public set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, value);

    if (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
  }

  public delete(key: K): void {
    this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public values(): V[] {
    return Array.from(this.entries.values());
  }
}

