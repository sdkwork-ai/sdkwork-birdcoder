export class BoundedRealtimeMessageQueue<T> {
  private readonly entries: Array<T | undefined>;
  private head = 0;
  private retained = 0;

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError(
        "Realtime message queue capacity must be a positive safe integer.",
      );
    }
    this.entries = new Array<T | undefined>(capacity);
  }

  get length(): number {
    return this.retained;
  }

  clear(): void {
    for (let offset = 0; offset < this.retained; offset += 1) {
      this.entries[(this.head + offset) % this.capacity] = undefined;
    }
    this.head = 0;
    this.retained = 0;
  }

  dequeue(): T | undefined {
    if (this.retained === 0) {
      return undefined;
    }

    const value = this.entries[this.head];
    this.entries[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.retained -= 1;
    if (this.retained === 0) {
      this.head = 0;
    }
    return value;
  }

  enqueue(value: T): boolean {
    if (this.retained >= this.capacity) {
      return false;
    }

    const tail = (this.head + this.retained) % this.capacity;
    this.entries[tail] = value;
    this.retained += 1;
    return true;
  }
}
