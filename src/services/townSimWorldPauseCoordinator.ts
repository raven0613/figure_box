import type { JoinableActivityManager } from '~/services/characterEvents/joinableActivities';
import type { TownCharacterTickCoordinator } from '~/services/townCharacterTickCoordinator';
import type { TownMovementCoordinator } from '~/services/townMovementCoordinator';
import type { TownActivityCoordinator } from '~/services/townActivityCoordinator';
import type { CharacterPerformanceRunner } from '~/services/characterEvents/characterPerformanceRunner';
import type { TransientMomentCoordinator } from '~/services/transientMomentCoordinator';
import { GameSimWorldState } from '~/stateMachines/gameFlow/states';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownSimWorldPauseCoordinatorOptions {
  activityManager: JoinableActivityManager;
  tickCoordinator: TownCharacterTickCoordinator;
  movementCoordinator: TownMovementCoordinator;
  activityCoordinator: TownActivityCoordinator;
  performanceRunner: CharacterPerformanceRunner;
  transientMomentCoordinator: TransientMomentCoordinator;
  widget: FabricTownMapWidget;
  notifyActivitiesChanged: () => void;
}

export class TownSimWorldPauseCoordinator {
  private readonly activityManager: JoinableActivityManager;
  private readonly tickCoordinator: TownCharacterTickCoordinator;
  private readonly movementCoordinator: TownMovementCoordinator;
  private readonly activityCoordinator: TownActivityCoordinator;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly transientMomentCoordinator: TransientMomentCoordinator;
  private readonly widget: FabricTownMapWidget;
  private readonly notifyActivitiesChanged: () => void;
  private readonly pausedActivityIds = new Set<string>();
  private pausedAt: number | null = null;

  constructor(options: TownSimWorldPauseCoordinatorOptions) {
    this.activityManager = options.activityManager;
    this.tickCoordinator = options.tickCoordinator;
    this.movementCoordinator = options.movementCoordinator;
    this.activityCoordinator = options.activityCoordinator;
    this.performanceRunner = options.performanceRunner;
    this.transientMomentCoordinator = options.transientMomentCoordinator;
    this.widget = options.widget;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  syncState(state: GameSimWorldState, observedActivityId: string | null): void {
    if (state === GameSimWorldState.Running) {
      this.resume();
      return;
    }

    if (state === GameSimWorldState.ManuallyPaused) {
      this.pause(null);
      return;
    }

    if (observedActivityId) {
      this.pause(observedActivityId);
    }
  }

  isPaused(): boolean {
    return this.pausedAt !== null;
  }

  clear(): void {
    this.pausedActivityIds.clear();
    this.pausedAt = null;
  }

  private pause(observedActivityId: string | null): void {
    if (this.isPaused()) {
      this.syncObservedActivityPause(observedActivityId);
      return;
    }

    const timestamp = Date.now();

    this.pausedAt = timestamp;
    this.tickCoordinator.pause();
    this.movementCoordinator.pauseWorld();
    this.syncObservedActivityPause(observedActivityId);
    this.transientMomentCoordinator.pauseWorld();
    this.activityManager.getActivities().forEach(activity => {
      if (activity.pausedAt !== undefined) {
        return;
      }

      const pausedActivity = this.activityManager.pauseActivity(activity.id, timestamp);

      if (pausedActivity?.pausedAt !== undefined) {
        this.pausedActivityIds.add(activity.id);
      }
    });

    if (this.pausedActivityIds.size > 0) {
      this.notifyActivitiesChanged();
    }
  }

  private syncObservedActivityPause(observedActivityId: string | null): void {
    const observedParticipantIds = observedActivityId
      ? this.activityManager.getActivity(observedActivityId)?.participantIds ?? []
      : [];

    this.widget.setPresentationPaused(true, observedParticipantIds);
    this.performanceRunner.pauseWorld(observedActivityId);
    this.activityCoordinator.pauseWorld(observedActivityId);
  }

  private resume(): void {
    if (this.pausedAt === null) {
      return;
    }

    const timestamp = Date.now();
    const pausedDurationMs = Math.max(0, timestamp - this.pausedAt);
    let didResumeActivity = false;

    this.pausedActivityIds.forEach(activityId => {
      const activity = this.activityManager.getActivity(activityId);

      if (!activity || activity.pausedAt === undefined) {
        return;
      }

      this.activityManager.resumeActivity(activityId, timestamp);
      didResumeActivity = true;
    });

    this.pausedActivityIds.clear();
    this.pausedAt = null;
    this.activityCoordinator.resumeWorld();
    this.performanceRunner.resumeWorld();
    this.transientMomentCoordinator.resumeWorld();
    this.widget.setPresentationPaused(false);
    this.movementCoordinator.resumeWorld();
    this.tickCoordinator.resumeAfterPause(pausedDurationMs);

    if (didResumeActivity) {
      this.notifyActivitiesChanged();
    }
  }
}
