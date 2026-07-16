type RealtimeCursorStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export const DEFAULT_REALTIME_CURSOR_MEMORY_CAPACITY = 256;
const REALTIME_CURSOR_STORAGE_INDEX_KEY =
  "sdkwork:birdcoder:realtime-cursor:bounded-index";

export class BoundedRealtimeCursorStore {
  private readonly memory = new Map<string, number>();
  private persistentIndexNeedsWrite = false;
  private persistentKeys: string[] | null = null;

  constructor(
    private readonly capacity = DEFAULT_REALTIME_CURSOR_MEMORY_CAPACITY,
    private readonly resolveStorage: () =>
      RealtimeCursorStorage | undefined = () => globalThis.sessionStorage,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError(
        "Realtime cursor memory capacity must be a positive safe integer.",
      );
    }
  }

  read(storageKey: string): number | undefined {
    const memoryCursor = this.memory.get(storageKey);
    if (memoryCursor !== undefined) {
      this.remember(storageKey, memoryCursor);
      this.touchPersistentKey(storageKey);
      return memoryCursor;
    }

    try {
      const storedValue = this.resolveStorage()?.getItem(storageKey);
      const parsedValue =
        storedValue == null ? Number.NaN : Number(storedValue);
      if (Number.isSafeInteger(parsedValue) && parsedValue >= 0) {
        this.remember(storageKey, parsedValue);
        this.touchPersistentKey(storageKey);
        return parsedValue;
      }
    } catch {
      // In-memory cursor recovery remains available when browser storage is unavailable.
    }
    return undefined;
  }

  write(storageKey: string, sequence: number): void {
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new RangeError(
        "Realtime cursor sequence must be a non-negative safe integer.",
      );
    }

    const currentSequence = this.read(storageKey);
    if (currentSequence !== undefined && currentSequence >= sequence) {
      return;
    }

    this.remember(storageKey, sequence);
    try {
      const storage = this.resolveStorage();
      storage?.setItem(storageKey, String(sequence));
      this.touchPersistentKey(storageKey, storage);
    } catch {
      // A storage quota or privacy mode must not break the active realtime channel.
    }
  }

  private remember(storageKey: string, sequence: number): void {
    this.memory.delete(storageKey);
    this.memory.set(storageKey, sequence);
    while (this.memory.size > this.capacity) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.memory.delete(oldestKey);
    }
  }

  private touchPersistentKey(
    storageKey: string,
    resolvedStorage?: RealtimeCursorStorage,
  ): void {
    try {
      const storage = resolvedStorage ?? this.resolveStorage();
      if (!storage) {
        return;
      }
      const persistentKeys = this.loadPersistentKeys(storage);
      if (persistentKeys.at(-1) === storageKey) {
        if (this.persistentIndexNeedsWrite) {
          storage.setItem(
            REALTIME_CURSOR_STORAGE_INDEX_KEY,
            JSON.stringify(persistentKeys),
          );
          this.persistentIndexNeedsWrite = false;
        }
        return;
      }
      const existingIndex = persistentKeys.indexOf(storageKey);
      if (existingIndex >= 0) {
        persistentKeys.splice(existingIndex, 1);
      }
      persistentKeys.push(storageKey);
      while (persistentKeys.length > this.capacity) {
        const evictedKey = persistentKeys.shift();
        if (evictedKey) {
          storage.removeItem(evictedKey);
        }
      }
      storage.setItem(
        REALTIME_CURSOR_STORAGE_INDEX_KEY,
        JSON.stringify(persistentKeys),
      );
      this.persistentIndexNeedsWrite = false;
    } catch {
      // Storage indexing is best effort; the active in-memory cursor remains bounded.
    }
  }

  private loadPersistentKeys(storage: RealtimeCursorStorage): string[] {
    if (this.persistentKeys !== null) {
      return this.persistentKeys;
    }
    const storedIndex = storage.getItem(REALTIME_CURSOR_STORAGE_INDEX_KEY);
    if (!storedIndex) {
      this.persistentKeys = [];
      return this.persistentKeys;
    }
    this.persistentIndexNeedsWrite = true;
    try {
      const parsedIndex = JSON.parse(storedIndex) as unknown;
      this.persistentKeys = Array.isArray(parsedIndex)
        ? [
            ...new Set(
              parsedIndex.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  value.length > 0 &&
                  value !== REALTIME_CURSOR_STORAGE_INDEX_KEY,
              ),
            ),
          ]
        : [];
    } catch {
      this.persistentKeys = [];
    }
    while (this.persistentKeys.length > this.capacity) {
      const evictedKey = this.persistentKeys.shift();
      if (evictedKey) {
        storage.removeItem(evictedKey);
      }
    }
    return this.persistentKeys;
  }
}
