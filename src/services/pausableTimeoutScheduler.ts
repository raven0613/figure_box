interface ScheduledTimeout {
  callback: () => void;
  remainingMs: number;
  startedAt: number | null;
  timeoutId: number | null;
}

export class PausableTimeoutScheduler {
  private readonly scheduledTimeouts = new Map<number, ScheduledTimeout>();
  private nextScheduledTimeoutId = 1;
  private isPaused = false;

  schedule(callback: () => void, delayMs: number): number {
    const scheduledTimeoutId = this.nextScheduledTimeoutId;
    const scheduledTimeout: ScheduledTimeout = {
      callback,
      remainingMs: Math.max(0, delayMs),
      startedAt: null,
      timeoutId: null,
    };

    this.nextScheduledTimeoutId += 1;
    this.scheduledTimeouts.set(scheduledTimeoutId, scheduledTimeout);

    if (!this.isPaused) {
      this.startScheduledTimeout(scheduledTimeoutId, scheduledTimeout);
    }

    return scheduledTimeoutId;
  }

  cancel(scheduledTimeoutId: number): void {
    const scheduledTimeout = this.scheduledTimeouts.get(scheduledTimeoutId);

    if (!scheduledTimeout) {
      return;
    }

    if (scheduledTimeout.timeoutId !== null) {
      window.clearTimeout(scheduledTimeout.timeoutId);
    }

    this.scheduledTimeouts.delete(scheduledTimeoutId);
  }

  pause(): void {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;
    const pausedAt = performance.now();

    this.scheduledTimeouts.forEach(scheduledTimeout => {
      if (scheduledTimeout.timeoutId === null || scheduledTimeout.startedAt === null) {
        return;
      }

      window.clearTimeout(scheduledTimeout.timeoutId);
      scheduledTimeout.remainingMs = Math.max(
        0,
        scheduledTimeout.remainingMs - (pausedAt - scheduledTimeout.startedAt),
      );
      scheduledTimeout.startedAt = null;
      scheduledTimeout.timeoutId = null;
    });
  }

  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.scheduledTimeouts.forEach((scheduledTimeout, scheduledTimeoutId) => {
      this.startScheduledTimeout(scheduledTimeoutId, scheduledTimeout);
    });
  }

  clear(): void {
    this.scheduledTimeouts.forEach(scheduledTimeout => {
      if (scheduledTimeout.timeoutId !== null) {
        window.clearTimeout(scheduledTimeout.timeoutId);
      }
    });
    this.scheduledTimeouts.clear();
  }

  hasScheduledTimeouts(): boolean {
    return this.scheduledTimeouts.size > 0;
  }

  private startScheduledTimeout(
    scheduledTimeoutId: number,
    scheduledTimeout: ScheduledTimeout,
  ): void {
    scheduledTimeout.startedAt = performance.now();
    scheduledTimeout.timeoutId = window.setTimeout(() => {
      if (this.scheduledTimeouts.get(scheduledTimeoutId) !== scheduledTimeout) {
        return;
      }

      this.scheduledTimeouts.delete(scheduledTimeoutId);
      scheduledTimeout.callback();
    }, scheduledTimeout.remainingMs);
  }
}
