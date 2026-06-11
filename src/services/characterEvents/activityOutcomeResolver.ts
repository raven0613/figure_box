import type { CharacterEventActivityEffects } from '~/constants/charactarEventsDefinitions';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';

export type ActivityOutcomeResolvedBy = 'characterPerformance' | 'dialogueViewScript';

export interface ActivityOutcome {
  id: string;
  effects?: CharacterEventActivityEffects;
}

export interface ResolveActivityOutcomeInput {
  activityId: string;
  participantIds: readonly string[];
  outcome: ActivityOutcome;
  resolvedBy: ActivityOutcomeResolvedBy;
  timestamp?: number;
}

export interface ResolvedActivityOutcome {
  activityId: string;
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
      participantIds: Array.from(new Set(input.participantIds)),
      outcome: {
        ...input.outcome,
        effects: input.outcome.effects
          ? { ...input.outcome.effects }
          : undefined,
      },
      resolvedBy: input.resolvedBy,
      timestamp: input.timestamp ?? Date.now(),
    };

    this.resolutionsByActivityId.set(input.activityId, resolution);
    this.pruneOldResolutions();
    resolution.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId: resolution.activityId,
        participantIds: resolution.participantIds,
        activityEffects: resolution.outcome.effects,
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
