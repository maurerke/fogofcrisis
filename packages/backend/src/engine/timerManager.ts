export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Schedule a one-shot callback after delayMs milliseconds.
   */
  scheduleTimeout(id: string, delayMs: number, callback: () => void): void {
    this.clearTimeout(id);
    const timer = setTimeout(() => {
      this.timers.delete(id);
      try {
        callback();
      } catch (err) {
        console.error(`[TimerManager] Error in timeout callback for '${id}':`, err);
      }
    }, delayMs);
    this.timers.set(id, timer);
  }

  /**
   * Schedule a repeating callback every intervalMs milliseconds.
   */
  scheduleInterval(id: string, intervalMs: number, callback: () => void): void {
    this.clearInterval(id);
    const interval = setInterval(() => {
      try {
        callback();
      } catch (err) {
        // Log but do NOT clear the interval — a transient error (e.g. a momentary
        // socket hiccup) must not permanently kill the countdown. The callback
        // itself calls clearInterval explicitly when the phase ends or times out.
        console.error(`[TimerManager] Error in interval callback for '${id}':`, err);
      }
    }, intervalMs);
    this.intervals.set(id, interval);
  }

  clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearInterval(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  /**
   * Clear all timers and intervals for this manager.
   */
  clearAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const interval of this.intervals.values()) clearInterval(interval);
    this.timers.clear();
    this.intervals.clear();
  }
}
