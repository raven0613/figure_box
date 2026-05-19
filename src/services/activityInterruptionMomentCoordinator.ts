import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterControlReason } from '~/stateMachines/gameFlow/controlReasons';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';

type CharacterLockPart = 'bodyAction' | 'bodyMove' | 'mind' | 'communication';

export interface ActivityInterruptionMoment {
  id: string;
  participantIds: readonly string[];
  observerIds: readonly string[];
  sourceActivityId?: string;
  sourceActivityIds: readonly string[];
  startedAt: number;
  endsAt: number;
}

export interface StartActivityInterruptionMomentInput {
  id: string;
  participantIds: readonly string[];
  observerIds?: readonly string[];
  sourceActivityId?: string;
  sourceActivityIds?: readonly string[];
  timestamp: number;
  durationMs: number;
  lockReason: CharacterControlReason;
  lockParts?: readonly CharacterLockPart[];
  controlState?: CharacterControlState;
  pauseParticipantWalks?: boolean;
  curiosityLabel?: string;
  onFinished?: (moment: ActivityInterruptionMoment) => void;
}

interface ActivityInterruptionMomentCoordinatorOptions {
  sendToCharacter: SendCharacterEvent;
  showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
  pauseActivity: (activityId: string, timestamp: number) => void;
  resumeActivity: (activityId: string, timestamp: number) => void;
  pauseCharacterWalk?: (characterId: string, durationMs: number) => void;
}

interface ActiveActivityInterruptionMoment extends ActivityInterruptionMoment {
  lockReason: CharacterControlReason;
  lockParts: readonly CharacterLockPart[];
  controlState?: CharacterControlState;
  onFinished?: (moment: ActivityInterruptionMoment) => void;
}

export class ActivityInterruptionMomentCoordinator {
  private readonly activeMomentsById = new Map<string, ActiveActivityInterruptionMoment>();
  private readonly momentIdsByCharacterId = new Map<string, string>();
  private readonly timerIdsByMomentId = new Map<string, number>();
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
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
    const affectedCharacterIds = getAffectedCharacterIds(input.participantIds, input.observerIds ?? []);

    if (affectedCharacterIds.some(characterId => this.isCharacterInMoment(characterId))) {
      return null;
    }

    const moment = this.createMoment(input);
    const momentCharacterIds = this.getAffectedCharacterIds(moment);

    this.activeMomentsById.set(moment.id, moment);
    momentCharacterIds.forEach(characterId => {
      this.momentIdsByCharacterId.set(characterId, moment.id);
    });

    if (moment.controlState) {
      this.setControlState(momentCharacterIds, moment.controlState, input.lockReason);
    }

    this.lockCharacters(momentCharacterIds, input.lockReason, moment.lockParts);

    if (input.pauseParticipantWalks) {
      this.pauseCharacterWalks(momentCharacterIds, input.durationMs);
    }

    moment.sourceActivityIds.forEach(activityId => {
      this.pauseActivity(activityId, input.timestamp);
    });

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

    const momentCharacterIds = this.getAffectedCharacterIds(moment);
    const timerId = this.timerIdsByMomentId.get(momentId);

    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.timerIdsByMomentId.delete(momentId);
    }

    this.unlockCharacters(momentCharacterIds, moment.lockReason, moment.lockParts);
    if (moment.controlState) {
      this.setControlState(momentCharacterIds, CharacterControlState.Normal, moment.lockReason);
    }

    moment.sourceActivityIds.forEach(activityId => {
      this.resumeActivity(activityId, Date.now());
    });

    momentCharacterIds.forEach(characterId => {
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
    const sourceActivityIds = uniqueStrings([
      ...(input.sourceActivityId ? [input.sourceActivityId] : []),
      ...(input.sourceActivityIds ?? []),
    ]);

    return {
      id: input.id,
      participantIds: [...input.participantIds],
      observerIds: [...(input.observerIds ?? [])],
      sourceActivityId: input.sourceActivityId ?? sourceActivityIds[0],
      sourceActivityIds,
      startedAt: input.timestamp,
      endsAt: input.timestamp + input.durationMs,
      lockReason: input.lockReason,
      lockParts: input.lockParts ?? ['mind'],
      controlState: input.controlState,
      onFinished: input.onFinished,
    };
  }

  private setControlState(
    characterIds: readonly string[],
    controlState: CharacterControlState,
    reason: CharacterControlReason,
  ): void {
    characterIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.SetControlState,
        controlState,
        reason,
      });
    });
  }

  private lockCharacters(
    characterIds: readonly string[],
    reason: CharacterControlReason,
    parts: readonly CharacterLockPart[],
  ): void {
    characterIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.AddLock,
        parts: [...parts],
        reason,
      });
    });
  }

  private unlockCharacters(
    characterIds: readonly string[],
    reason: CharacterControlReason,
    parts: readonly CharacterLockPart[],
  ): void {
    characterIds.forEach(characterId => {
      this.sendToCharacter(characterId, {
        type: EventType.RemoveLock,
        parts: [...parts],
        reason,
      });
    });
  }

  private pauseCharacterWalks(characterIds: readonly string[], durationMs: number): void {
    if (!this.pauseCharacterWalk) {
      return;
    }

    characterIds.forEach(characterId => {
      this.pauseCharacterWalk?.(characterId, durationMs);
    });
  }

  private getAffectedCharacterIds(moment: ActivityInterruptionMoment): string[] {
    return getAffectedCharacterIds(moment.participantIds, moment.observerIds);
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
    sourceActivityIds: moment.sourceActivityIds,
    startedAt: moment.startedAt,
    endsAt: moment.endsAt,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function getAffectedCharacterIds(
  participantIds: readonly string[],
  observerIds: readonly string[],
): string[] {
  return uniqueStrings([...participantIds, ...observerIds]);
}
