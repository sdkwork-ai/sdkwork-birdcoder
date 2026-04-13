type EventCallback = (...args: any[]) => void;

export class EventBus {
  private listeners: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => {
      try {
        cb(...args);
      } catch (error) {
        console.error(`Error executing event listener for ${event}:`, error);
      }
    });
  }
}

export const globalEventBus = new EventBus();
