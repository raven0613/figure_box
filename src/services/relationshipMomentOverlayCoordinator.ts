import {
  TransientMomentCoordinator,
  type TransientMoment,
} from '~/services/transientMomentCoordinator';
import { CharacterControlReason } from '~/stateMachines/gameFlow/controlReasons';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';

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
  momentCoordinator: TransientMomentCoordinator;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  onOverlayFinished: (overlay: RelationshipMomentOverlay) => void;
}

export class RelationshipMomentOverlayCoordinator {
  private readonly activeOverlaysById = new Map<string, RelationshipMomentOverlay>();
  private readonly overlayIdsByCharacterId = new Map<string, string>();
  private readonly momentCoordinator: TransientMomentCoordinator;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly onOverlayFinished: (overlay: RelationshipMomentOverlay) => void;

  constructor(options: RelationshipMomentOverlayCoordinatorOptions) {
    this.momentCoordinator = options.momentCoordinator;
    this.showCharacterBubble = options.showCharacterBubble;
    this.onOverlayFinished = options.onOverlayFinished;
  }

  start(input: StartRelationshipMomentOverlayInput): RelationshipMomentOverlay | null {
    if (this.isCharacterInOverlay(input.actorId) || this.isCharacterInOverlay(input.targetCharacterId)) {
      return null;
    }

    const overlay = this.createOverlay(input);
    const participantIds = this.getParticipantIds(overlay);
    const moment = this.momentCoordinator.start({
      id: overlay.id,
      participantIds,
      observerIds: overlay.observerIds,
      sourceActivityId: overlay.sourceActivityId,
      timestamp: input.timestamp,
      durationMs: input.durationMs,
      lockReason: CharacterControlReason.GodDropRelationshipMoment,
      controlState: CharacterControlState.RelationshipMoment,
      pauseParticipantWalks: true,
      curiosityLabel: '好奇',
      onFinished: momentOverlay => {
        this.finish(momentOverlay);
      },
    });

    if (!moment) {
      return null;
    }

    this.activeOverlaysById.set(overlay.id, overlay);
    participantIds.forEach(characterId => {
      this.overlayIdsByCharacterId.set(characterId, overlay.id);
    });

    this.showCharacterBubble(input.actorId, input.label, input.durationMs);
    this.showCharacterBubble(input.targetCharacterId, input.targetBubbleText, input.durationMs);
    return overlay;
  }

  isCharacterInOverlay(characterId: string): boolean {
    return this.overlayIdsByCharacterId.has(characterId);
  }

  dispose(): void {
    Array.from(this.activeOverlaysById.keys()).forEach(overlayId => {
      this.momentCoordinator.finish(overlayId);
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

  private finish(moment: TransientMoment): void {
    const overlay = this.activeOverlaysById.get(moment.id);

    if (!overlay) {
      return;
    }

    const participantIds = this.getParticipantIds(overlay);

    participantIds.forEach(characterId => {
      this.overlayIdsByCharacterId.delete(characterId);
    });
    this.activeOverlaysById.delete(moment.id);
    this.onOverlayFinished(overlay);
  }

  private getParticipantIds(overlay: RelationshipMomentOverlay): readonly string[] {
    return [overlay.actorId, overlay.targetCharacterId];
  }
}
