import { EventType } from '~/stateMachines/gameFlow/events';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';

export interface RelationshipMomentOverlay {
  id: string;
  actorId: string;
  targetCharacterId: string;
  observerIds: readonly string[];
  sourceActivityId?: string;
  startedAt: number;
  endsAt: number;
}

interface StartRelationshipMomentOverlayInput {
  actorId: string;
  targetCharacterId: string;
  label: string;
  targetBubbleText: string;
  observerIds: readonly string[];
  sourceActivityId?: string;
  timestamp: number;
  durationMs: number;
}

interface RelationshipMomentOverlayCoordinatorOptions {
  sendToCharacter: SendCharacterEvent;
  pauseCharacterWalk: (characterId: string, durationMs: number) => void;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  showMapActivity: (activity: MapActivityView, durationMs?: number) => void;
  pauseActivity: (activityId: string, timestamp: number) => void;
  resumeActivity: (activityId: string, timestamp: number) => void;
  onOverlayFinished: (participantIds: readonly string[]) => void;
}

const RELATIONSHIP_MOMENT_LOCK_REASON = 'godDropRelationshipMoment';

export class RelationshipMomentOverlayCoordinator {
  private readonly activeOverlaysById = new Map<string, RelationshipMomentOverlay>();
  private readonly overlayIdsByCharacterId = new Map<string, string>();
  private readonly timerIdsByOverlayId = new Map<string, number>();
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly pauseCharacterWalk: (characterId: string, durationMs: number) => void;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly showMapActivity: (activity: MapActivityView, durationMs?: number) => void;
  private readonly pauseActivity: (activityId: string, timestamp: number) => void;
  private readonly resumeActivity: (activityId: string, timestamp: number) => void;
  private readonly onOverlayFinished: (participantIds: readonly string[]) => void;

  constructor(options: RelationshipMomentOverlayCoordinatorOptions) {
    this.sendToCharacter = options.sendToCharacter;
    this.pauseCharacterWalk = options.pauseCharacterWalk;
    this.showCharacterBubble = options.showCharacterBubble;
    this.showMapActivity = options.showMapActivity;
    this.pauseActivity = options.pauseActivity;
    this.resumeActivity = options.resumeActivity;
    this.onOverlayFinished = options.onOverlayFinished;
  }

  start(input: StartRelationshipMomentOverlayInput): RelationshipMomentOverlay | null {
    if (this.isCharacterInOverlay(input.actorId) || this.isCharacterInOverlay(input.targetCharacterId)) {
      return null;
    }

    const overlay = this.createOverlay(input);
    const participantIds = this.getParticipantIds(overlay);

    this.activeOverlaysById.set(overlay.id, overlay);
    participantIds.forEach(characterId => {
      this.overlayIdsByCharacterId.set(characterId, overlay.id);
    });

    this.lockParticipants(participantIds);
    if (overlay.sourceActivityId) {
      this.pauseActivity(overlay.sourceActivityId, input.timestamp);
    }
    this.pauseCharacterWalk(input.targetCharacterId, input.durationMs);
    this.showCharacterBubble(input.actorId, input.label, input.durationMs);
    this.showCharacterBubble(input.targetCharacterId, input.targetBubbleText, input.durationMs);
    this.showObserverCuriosity(overlay, input.durationMs);

    const timerId = window.setTimeout(() => {
      this.finish(overlay.id);
    }, input.durationMs);
    this.timerIdsByOverlayId.set(overlay.id, timerId);
    return overlay;
  }

  isCharacterInOverlay(characterId: string): boolean {
    return this.overlayIdsByCharacterId.has(characterId);
  }

  dispose(): void {
    Array.from(this.activeOverlaysById.keys()).forEach(overlayId => {
      this.finish(overlayId);
    });
  }

  private createOverlay(input: StartRelationshipMomentOverlayInput): RelationshipMomentOverlay {
    return {
      id: `relationship-moment-${input.actorId}-${input.targetCharacterId}-${input.timestamp}`,
      actorId: input.actorId,
      targetCharacterId: input.targetCharacterId,
      observerIds: [...input.observerIds],
      sourceActivityId: input.sourceActivityId,
      startedAt: input.timestamp,
      endsAt: input.timestamp + input.durationMs,
    };
  }

  private finish(overlayId: string): void {
    const overlay = this.activeOverlaysById.get(overlayId);

    if (!overlay) {
      return;
    }

    const timerId = this.timerIdsByOverlayId.get(overlayId);

    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.timerIdsByOverlayId.delete(overlayId);
    }

    const participantIds = this.getParticipantIds(overlay);

    if (overlay.sourceActivityId) {
      this.resumeActivity(overlay.sourceActivityId, Date.now());
    }
    this.unlockParticipants(participantIds);
    participantIds.forEach(characterId => {
      this.overlayIdsByCharacterId.delete(characterId);
    });
    this.activeOverlaysById.delete(overlayId);
    this.onOverlayFinished(participantIds);
  }

  private lockParticipants(participantIds: readonly string[]): void {
    participantIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.AddLock,
        parts: ['mind'],
        reason: RELATIONSHIP_MOMENT_LOCK_REASON,
      });
    });
  }

  private unlockParticipants(participantIds: readonly string[]): void {
    participantIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.RemoveLock,
        parts: ['mind'],
        reason: RELATIONSHIP_MOMENT_LOCK_REASON,
      });
    });
  }

  private showObserverCuriosity(overlay: RelationshipMomentOverlay, durationMs: number): void {
    overlay.observerIds.forEach(observerId => {
      this.showMapActivity({
        id: `${overlay.id}-curious-${observerId}`,
        label: '好奇',
        participantIds: [observerId],
      }, durationMs);
    });
  }

  private getParticipantIds(overlay: RelationshipMomentOverlay): readonly string[] {
    return [overlay.actorId, overlay.targetCharacterId];
  }
}
