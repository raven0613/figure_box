import type {
  CharacterEventActivityEffects,
  CharacterEventActivityEffectsByRole,
  CharacterEventActivityMemoryEffect,
} from '~/constants/charactarEventsDefinitions';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import { resolveActivityEffectsForRole } from './activityCompletionEffects';

export type ActivityOutcomeResolvedBy = 'characterPerformance' | 'dialogueViewScript';

export interface ActivityOutcome {
  id: string;
  effects?: CharacterEventActivityEffects;
  effectsByRole?: CharacterEventActivityEffectsByRole;
  memoryEffects?: readonly CharacterEventActivityMemoryEffect[];
}

export interface ResolveActivityOutcomeInput {
  activityId: string;
  sourceEventId?: string;
  participantIds: readonly string[];
  hostCharacterIds?: readonly string[];
  dialogueSubjectId?: string;
  outcome: ActivityOutcome;
  resolvedBy: ActivityOutcomeResolvedBy;
  timestamp?: number;
}

export interface ResolvedActivityOutcome {
  activityId: string;
  sourceEventId?: string;
  participantIds: readonly string[];
  outcome: ActivityOutcome;
  resolvedBy: ActivityOutcomeResolvedBy;
  timestamp: number;
}

interface ActivityOutcomeResolverOptions {
  sendToCharacter: SendCharacterEvent;
}

const MAX_RETAINED_ACTIVITY_OUTCOMES = 500;

export class ActivityOutcomeResolver {
  private readonly resolutionsByActivityId = new Map<string, ResolvedActivityOutcome>();
  private readonly sendToCharacter: SendCharacterEvent;

  constructor(options: ActivityOutcomeResolverOptions) {
    this.sendToCharacter = options.sendToCharacter;
  }

  resolveActivityOutcome(input: ResolveActivityOutcomeInput): ResolvedActivityOutcome {
    const existingResolution = this.resolutionsByActivityId.get(input.activityId);

    if (existingResolution) {
      return existingResolution;
    }

    const resolution: ResolvedActivityOutcome = {
      activityId: input.activityId,
      sourceEventId: input.sourceEventId,
      participantIds: Array.from(new Set(input.participantIds)),
      outcome: {
        ...input.outcome,
        effects: input.outcome.effects
          ? { ...input.outcome.effects }
          : undefined,
        effectsByRole: cloneEffectsByRole(input.outcome.effectsByRole),
        memoryEffects: input.outcome.memoryEffects
          ? input.outcome.memoryEffects.map(effect => ({ ...effect }))
          : undefined,
      },
      resolvedBy: input.resolvedBy,
      timestamp: input.timestamp ?? Date.now(),
    };

    this.resolutionsByActivityId.set(input.activityId, resolution);
    this.pruneOldResolutions();
    const initiatorIds = new Set(
      input.hostCharacterIds ?? resolution.participantIds.slice(0, 1),
    );
    const initiatorId = Array.from(initiatorIds)[0];
    const targetId = resolution.participantIds.find(participantId => (
      !initiatorIds.has(participantId)
    ));

    applyActivityMemoryEffects({
      sendToCharacter: this.sendToCharacter,
      memoryEffects: resolution.outcome.memoryEffects,
      participantIds: resolution.participantIds,
      initiatorId,
      targetId,
      dialogueSubjectId: input.dialogueSubjectId,
      timestamp: resolution.timestamp,
    });

    resolution.participantIds.forEach(participantId => {
      const role = initiatorIds.has(participantId) ? 'initiator' : 'target';

      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId: resolution.activityId,
        participantIds: resolution.participantIds,
        sourceEventId: resolution.sourceEventId,
        activityRole: role,
        activityEffects: resolveActivityEffectsForRole(
          resolution.outcome.effects,
          resolution.outcome.effectsByRole,
          role,
        ),
        outcomeId: resolution.outcome.id,
        resolvedBy: resolution.resolvedBy,
        timestamp: resolution.timestamp,
      });
    });

    return resolution;
  }

  getResolution(activityId: string): ResolvedActivityOutcome | null {
    return this.resolutionsByActivityId.get(activityId) ?? null;
  }

  clear(): void {
    this.resolutionsByActivityId.clear();
  }

  private pruneOldResolutions(): void {
    while (this.resolutionsByActivityId.size > MAX_RETAINED_ACTIVITY_OUTCOMES) {
      const oldestActivityId = this.resolutionsByActivityId.keys().next().value;

      if (oldestActivityId === undefined) {
        return;
      }

      this.resolutionsByActivityId.delete(oldestActivityId);
    }
  }
}

function applyActivityMemoryEffects(input: {
  sendToCharacter: SendCharacterEvent;
  memoryEffects: readonly CharacterEventActivityMemoryEffect[] | undefined;
  participantIds: readonly string[];
  initiatorId: string | undefined;
  targetId: string | undefined;
  dialogueSubjectId: string | undefined;
  timestamp: number;
}): void {
  input.memoryEffects?.forEach(effect => {
    const recipientIds = effect.recipientRole === 'both'
      ? input.participantIds
      : [effect.recipientRole === 'initiator' ? input.initiatorId : input.targetId]
        .filter((characterId): characterId is string => characterId !== undefined);
    const startedById = effect.startedByRole === 'target'
      ? input.targetId
      : input.initiatorId;

    recipientIds.forEach(recipientId => {
      const memoryTargetId = effect.target === 'dialogueSubject'
        ? input.dialogueSubjectId
        : input.participantIds.find(participantId => participantId !== recipientId);

      if (!memoryTargetId || !startedById) {
        return;
      }

      input.sendToCharacter(recipientId, {
        type: EventType.RememberRelationshipMemory,
        targetCharId: memoryTargetId,
        memoryType: effect.memoryType,
        countDelta: effect.countDelta,
        startedById,
        timestamp: input.timestamp,
      });
    });
  });
}

function cloneEffectsByRole(
  effectsByRole: CharacterEventActivityEffectsByRole | undefined,
): CharacterEventActivityEffectsByRole | undefined {
  if (!effectsByRole) {
    return undefined;
  }

  return {
    initiator: effectsByRole.initiator
      ? { ...effectsByRole.initiator }
      : undefined,
    target: effectsByRole.target
      ? { ...effectsByRole.target }
      : undefined,
  };
}
