type InternalEventHandler = (...args: unknown[]) => void;

export class EventBus {
  private listeners: Record<string, InternalEventHandler[]> = {};
  private maxListeners: number | null = null;

  setMaxListeners(count: number | null) {
    this.maxListeners = count;
  }

  on(event: string, callback: (...args: never[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    if (this.maxListeners !== null && this.listeners[event].length >= this.maxListeners) {
      console.warn(
        `[EventBus] Max listeners (${this.maxListeners}) exceeded for event "${event}". Possible memory leak.`,
      );
    }

    const handler = callback as InternalEventHandler;
    this.listeners[event].push(handler);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: never[]) => void) {
    if (!this.listeners[event]) return;
    const handler = callback as InternalEventHandler;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== handler);
    if (this.listeners[event].length === 0) {
      delete this.listeners[event];
    }
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  emit(event: string, ...args: unknown[]) {
    if (!this.listeners[event]) return;
    const callbacks = [...this.listeners[event]];
    for (const callback of callbacks) {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error executing event listener for ${event}:`, error);
      }
    }
  }

  listenerCount(event: string): number {
    return this.listeners[event]?.length ?? 0;
  }

  eventNames(): string[] {
    return Object.keys(this.listeners);
  }
}

export const globalEventBus = new EventBus();
