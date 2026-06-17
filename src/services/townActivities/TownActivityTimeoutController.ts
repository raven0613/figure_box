import { PausableTimeoutScheduler } from '~/services/pausableTimeoutScheduler';

export class TownActivityTimeoutController {
  private readonly timeoutSchedulersByActivityId = new Map<string, PausableTimeoutScheduler>();
  private observedActivityId: string | null = null;
  private isWorldPaused = false;

  pauseWorld(observedActivityId: string | null): void {
    this.isWorldPaused = true;
    this.observedActivityId = observedActivityId;
    this.timeoutSchedulersByActivityId.forEach((scheduler, activityId) => {
      if (activityId !== observedActivityId) {
        scheduler.pause();
      }
    });
  }

  resumeWorld(): void {
    if (!this.isWorldPaused) {
      return;
    }

    this.isWorldPaused = false;
    this.observedActivityId = null;
    this.timeoutSchedulersByActivityId.forEach(scheduler => scheduler.resume());
  }

  dispose(): void {
    this.timeoutSchedulersByActivityId.forEach(scheduler => scheduler.clear());
    this.timeoutSchedulersByActivityId.clear();
  }

  scheduleActivityTimeout(
    activityId: string,
    callback: () => void,
    delayMs: number,
  ): void {
    const scheduler = this.getActivityTimeoutScheduler(activityId);

    scheduler.schedule(() => {
      callback();

      if (!scheduler.hasScheduledTimeouts()) {
        this.timeoutSchedulersByActivityId.delete(activityId);
      }
    }, delayMs);
  }

  private getActivityTimeoutScheduler(activityId: string): PausableTimeoutScheduler {
    const existingScheduler = this.timeoutSchedulersByActivityId.get(activityId);

    if (existingScheduler) {
      return existingScheduler;
    }

    const scheduler = new PausableTimeoutScheduler();

    if (this.isWorldPaused && activityId !== this.observedActivityId) {
      scheduler.pause();
    }

    this.timeoutSchedulersByActivityId.set(activityId, scheduler);
    return scheduler;
  }
}
