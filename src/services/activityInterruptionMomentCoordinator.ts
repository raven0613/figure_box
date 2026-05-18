import { EventType } from '~/stateMachines/gameFlow/events';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';

type CharacterLockPart = 'bodyAction' | 'bodyMove' | 'mind' | 'communication';

export interface ActivityInterruptionMoment {
  id: string;
  participantIds: readonly string[];
  observerIds: readonly string[];
  sourceActivityId?: string;
  startedAt: number;
  endsAt: number;
}

export interface StartActivityInterruptionMomentInput {
  id: string;
  participantIds: readonly string[];
  observerIds?: readonly string[];
  sourceActivityId?: string;
  timestamp: number;
  durationMs: number;
  lockReason: string;
  lockParts?: readonly CharacterLockPart[];
  pauseParticipantWalks?: boolean;
  curiosityLabel?: string;
  onFinished?: (moment: ActivityInterruptionMoment) => void;
}

interface ActivityInterruptionMomentCoordinatorOptions {
  sendToCharacter: SendCharacterEvent;
  showMapActivity: (activity: MapActivityView, durationMs?: number) => void;
  pauseActivity: (activityId: string, timestamp: number) => void;
  resumeActivity: (activityId: string, timestamp: number) => void;
  pauseCharacterWalk?: (characterId: string, durationMs: number) => void;
}

interface ActiveActivityInterruptionMoment extends ActivityInterruptionMoment {
  lockReason: string;
  lockParts: readonly CharacterLockPart[];
  onFinished?: (moment: ActivityInterruptionMoment) => void;
}

export class ActivityInterruptionMomentCoordinator {
  private readonly activeMomentsById = new Map<string, ActiveActivityInterruptionMoment>();
  private readonly momentIdsByCharacterId = new Map<string, string>();
  private readonly timerIdsByMomentId = new Map<string, number>();
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showMapActivity: (activity: MapActivityView, durationMs?: number) => void;
  private readonly pauseActivity: (activityId: string, timestamp: number) => void;
  private readonly resumeActivity: (activityId: string, timestamp: number) => void;
  private readonly pauseCharacterWalk?: (characterId: string, durationMs: number) => void;

  constructor(options: ActivityInterruptionMomentCoordinatorOptions) {
    this.sendToCharacter = options.sendToCharacter;
    this.showMapActivity = options.showMapActivity;
    this.pauseActivity = options.pauseActivity;
    this.resumeActivity = options.resumeActivity;
    this.pauseCharacterWalk = options.pauseCharacterWalk;
  }

  start(input: StartActivityInterruptionMomentInput): ActivityInterruptionMoment | null {
    if (input.participantIds.some(characterId => this.isCharacterInMoment(characterId))) {
      return null;
    }

    const moment = this.createMoment(input);

    this.activeMomentsById.set(moment.id, moment);
    moment.participantIds.forEach(characterId => {
      this.momentIdsByCharacterId.set(characterId, moment.id);
    });
    this.lockParticipants(moment.participantIds, input.lockReason, moment.lockParts);

    if (input.pauseParticipantWalks) {
      this.pauseParticipantWalks(moment.participantIds, input.durationMs);
    }

    if (moment.sourceActivityId) {
      this.pauseActivity(moment.sourceActivityId, input.timestamp);
    }

    this.showObserverCuriosity(moment, input.durationMs, input.curiosityLabel ?? '好奇');

    const timerId = window.setTimeout(() => {
      this.finish(moment.id);
    }, input.durationMs);
    this.timerIdsByMomentId.set(moment.id, timerId);

    return moment;
  }

  isCharacterInMoment(characterId: string): boolean {
    return this.momentIdsByCharacterId.has(characterId);
  }

  finish(momentId: string): void {
    const moment = this.activeMomentsById.get(momentId);

    if (!moment) {
      return;
    }

    const timerId = this.timerIdsByMomentId.get(momentId);

    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.timerIdsByMomentId.delete(momentId);
    }

    if (moment.sourceActivityId) {
      this.resumeActivity(moment.sourceActivityId, Date.now());
    }

    this.unlockParticipants(moment.participantIds, moment.lockReason, moment.lockParts);
    moment.participantIds.forEach(characterId => {
      this.momentIdsByCharacterId.delete(characterId);
    });
    this.activeMomentsById.delete(momentId);
    moment.onFinished?.(toPublicMoment(moment));
  }

  dispose(): void {
    Array.from(this.activeMomentsById.keys()).forEach(momentId => {
      this.finish(momentId);
    });
  }

  private createMoment(input: StartActivityInterruptionMomentInput): ActiveActivityInterruptionMoment {
    return {
      id: input.id,
      participantIds: [...input.participantIds],
      observerIds: [...(input.observerIds ?? [])],
      sourceActivityId: input.sourceActivityId,
      startedAt: input.timestamp,
      endsAt: input.timestamp + input.durationMs,
      lockReason: input.lockReason,
      lockParts: input.lockParts ?? ['mind'],
      onFinished: input.onFinished,
    };
  }

  private lockParticipants(
    participantIds: readonly string[],
    reason: string,
    parts: readonly CharacterLockPart[],
  ): void {
    participantIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.AddLock,
        parts: [...parts],
        reason,
      });
    });
  }

  private unlockParticipants(
    participantIds: readonly string[],
    reason: string,
    parts: readonly CharacterLockPart[],
  ): void {
    participantIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.RemoveLock,
        parts: [...parts],
        reason,
      });
    });
  }

  private pauseParticipantWalks(participantIds: readonly string[], durationMs: number): void {
    if (!this.pauseCharacterWalk) {
      return;
    }

    participantIds.forEach(characterId => {
      this.pauseCharacterWalk?.(characterId, durationMs);
    });
  }

  private showObserverCuriosity(
    moment: ActivityInterruptionMoment,
    durationMs: number,
    label: string,
  ): void {
    moment.observerIds.forEach(observerId => {
      this.showMapActivity({
        id: `${moment.id}-curious-${observerId}`,
        label,
        participantIds: [observerId],
      }, durationMs);
    });
  }
}

function toPublicMoment(moment: ActiveActivityInterruptionMoment): ActivityInterruptionMoment {
  return {
    id: moment.id,
    participantIds: moment.participantIds,
    observerIds: moment.observerIds,
    sourceActivityId: moment.sourceActivityId,
    startedAt: moment.startedAt,
    endsAt: moment.endsAt,
  };
}
