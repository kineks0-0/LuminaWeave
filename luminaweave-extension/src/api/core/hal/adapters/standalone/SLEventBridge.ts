import { IEventBridge } from "../../interfaces";

export class SLEventBridge implements IEventBridge {
  private handlers: Map<string, ((...args: any[]) => void)[]> = new Map();

  bindHostEvents(): void {}

  unbindHostEvents(): void {}

  on(event: string, callback: (...args: any[]) => void): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(callback);
    this.handlers.set(event, handlers);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      this.handlers.set(
        event,
        handlers.filter((h) => h != callback),
      );
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }
}
