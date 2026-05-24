import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterControlReason } from '~/stateMachines/gameFlow/controlReasons';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';

type CharacterLockPart = 'bodyAction' | 'bodyMove' | 'mind' | 'communication';

interface PlayTransientPerformanceInput {
  performanceId: string;
  characterId: string;
}

export interface TransientMoment {
  id: string;
  participantIds: readonly string[];
  observerIds: readonly string[];
  sourceActivityId?: string;
  sourceActivityIds: readonly string[];
  startedAt: number;
  endsAt: number;
}

export interface StartTransientMomentInput {
  id: string;
  participantIds: readonly string[];
  observerIds?: readonly string[];
  sourceActivityId?: string;
  sourceActivityIds?: readonly string[];
  timestamp: number;
  durationMs: number;
  lockReason?: CharacterControlReason;
  lockParts?: readonly CharacterLockPart[];
  controlState?: CharacterControlState;
  pauseParticipantWalks?: boolean;
  curiosityLabel?: string;
  performanceId?: string;
  performanceCharacterIds?: readonly string[];
  restoreActiveVisuals?: boolean;
  onFinished?: (moment: TransientMoment) => void;
}

interface TransientMomentCoordinatorOptions {
  sendToCharacter: SendCharacterEvent;
  showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
  pauseActivity: (activityId: string, timestamp: number) => void;
  resumeActivity: (activityId: string, timestamp: number) => void;
  playPerformance?: (input: PlayTransientPerformanceInput) => number;
  restoreActiveVisualsForCharacters?: (characterIds: readonly string[]) => void;
  pauseCharacterWalk?: (characterId: string, durationMs: number) => void;
  resumeCharacterWalk?: (characterId: string) => void;
}

interface ActiveTransientMoment extends TransientMoment {
  lockReason?: CharacterControlReason;
  lockParts: readonly CharacterLockPart[];
  controlState?: CharacterControlState;
  pauseParticipantWalks: boolean;
  restoreActiveVisuals: boolean;
  onFinished?: (moment: TransientMoment) => void;
}

export class TransientMomentCoordinator {
  private readonly activeMomentsById = new Map<string, ActiveTransientMoment>();
  private readonly momentIdsByCharacterId = new Map<string, string>();
  private readonly timerIdsByMomentId = new Map<string, number>();
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
  private readonly pauseActivity: (activityId: string, timestamp: number) => void;
  private readonly resumeActivity: (activityId: string, timestamp: number) => void;
  private readonly playPerformance?: (input: PlayTransientPerformanceInput) => number;
  private readonly restoreActiveVisualsForCharacters?: (characterIds: readonly string[]) => void;
  private readonly pauseCharacterWalk?: (characterId: string, durationMs: number) => void;
  private readonly resumeCharacterWalk?: (characterId: string) => void;

  constructor(options: TransientMomentCoordinatorOptions) {
    this.sendToCharacter = options.sendToCharacter;
    this.showMapActivity = options.showMapActivity;
    this.pauseActivity = options.pauseActivity;
    this.resumeActivity = options.resumeActivity;
    this.playPerformance = options.playPerformance;
    this.restoreActiveVisualsForCharacters = options.restoreActiveVisualsForCharacters;
    this.pauseCharacterWalk = options.pauseCharacterWalk;
    this.resumeCharacterWalk = options.resumeCharacterWalk;
  }

  start(input: StartTransientMomentInput): TransientMoment | null {
    const affectedCharacterIds = getAffectedCharacterIds(input.participantIds, input.observerIds ?? []);

    if (affectedCharacterIds.some(characterId => this.isCharacterInMoment(characterId))) {
      return null;
    }

    let moment = this.createMoment(input);
    const momentCharacterIds = this.getAffectedCharacterIds(moment);

    this.activeMomentsById.set(moment.id, moment);
    momentCharacterIds.forEach(characterId => {
      this.momentIdsByCharacterId.set(characterId, moment.id);
    });

    if (moment.controlState && moment.lockReason) {
      this.setControlState(momentCharacterIds, moment.controlState, moment.lockReason);
    }

    if (moment.lockReason) {
      this.lockCharacters(momentCharacterIds, moment.lockReason, moment.lockParts);
    }

    moment.sourceActivityIds.forEach(activityId => {
      this.pauseActivity(activityId, input.timestamp);
    });

    this.showObserverCuriosity(moment, input.durationMs, input.curiosityLabel ?? '好奇');
    const performanceDurationMs = this.playMomentPerformance(moment, input);
    const durationMs = Math.max(input.durationMs, performanceDurationMs);

    if (durationMs !== input.durationMs) {
      moment = {
        ...moment,
        endsAt: input.timestamp + durationMs,
      };
      this.activeMomentsById.set(moment.id, moment);
    }

    if (input.pauseParticipantWalks) {
      this.pauseCharacterWalks(momentCharacterIds, durationMs);
    }

    const timerId = window.setTimeout(() => {
      this.finish(moment.id);
    }, durationMs);
    this.timerIdsByMomentId.set(moment.id, timerId);

    return toPublicMoment(moment);
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

    if (moment.lockReason) {
      this.unlockCharacters(momentCharacterIds, moment.lockReason, moment.lockParts);
    }

    if (moment.controlState && moment.lockReason) {
      this.setControlState(momentCharacterIds, CharacterControlState.Normal, moment.lockReason);
    }

    if (moment.pauseParticipantWalks) {
      this.resumeCharacterWalks(momentCharacterIds);
    }

    moment.sourceActivityIds.forEach(activityId => {
      this.resumeActivity(activityId, Date.now());
    });

    momentCharacterIds.forEach(characterId => {
      this.momentIdsByCharacterId.delete(characterId);
    });
    this.activeMomentsById.delete(momentId);
    moment.onFinished?.(toPublicMoment(moment));
    this.restoreActiveVisuals(moment, momentCharacterIds);
  }

  dispose(): void {
    Array.from(this.activeMomentsById.keys()).forEach(momentId => {
      this.finish(momentId);
    });
  }

  private createMoment(input: StartTransientMomentInput): ActiveTransientMoment {
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
      pauseParticipantWalks: input.pauseParticipantWalks ?? false,
      restoreActiveVisuals: input.restoreActiveVisuals ?? true,
      onFinished: input.onFinished,
    };
  }

  private playMomentPerformance(
    moment: TransientMoment,
    input: StartTransientMomentInput,
  ): number {
    if (!input.performanceId || !this.playPerformance) {
      return 0;
    }

    const performanceCharacterIds = input.performanceCharacterIds ?? moment.participantIds;

    const performanceId = input.performanceId;

    return Math.max(
      0,
      ...performanceCharacterIds.map(characterId => this.playPerformance?.({
        performanceId,
        characterId,
      }) ?? 0),
    );
  }

  private restoreActiveVisuals(
    moment: ActiveTransientMoment,
    characterIds: readonly string[],
  ): void {
    if (!moment.restoreActiveVisuals || !this.restoreActiveVisualsForCharacters) {
      return;
    }

    window.setTimeout(() => {
      this.restoreActiveVisualsForCharacters?.(characterIds);
    }, 0);
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

  private resumeCharacterWalks(characterIds: readonly string[]): void {
    if (!this.resumeCharacterWalk) {
      return;
    }

    characterIds.forEach(characterId => {
      this.resumeCharacterWalk?.(characterId);
    });
  }

  private getAffectedCharacterIds(moment: TransientMoment): string[] {
    return getAffectedCharacterIds(moment.participantIds, moment.observerIds);
  }

  private showObserverCuriosity(
    moment: TransientMoment,
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

function toPublicMoment(moment: ActiveTransientMoment): TransientMoment {
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
