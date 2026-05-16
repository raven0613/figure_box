import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventDefinition,
} from '~/constants/charactarEventsDefinitions';
import { shouldAcceptInteraction } from '~/services/characterEvents/interactionAcceptance';
import { canStartInteractionWithTarget } from '~/services/characterEvents/interactionCooldowns';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';

export type InteractionAcceptanceDecision =
  | { accepted: true }
  | { accepted: false; reason: 'busy' | 'mood' };

interface TownInteractionEvaluatorOptions {
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  isCharacterBodyFrozen: (characterId: string) => boolean;
}

// 判斷目標是否能接受互動
export class TownInteractionEvaluator {
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly isCharacterBodyFrozen: (characterId: string) => boolean;

  constructor(options: TownInteractionEvaluatorOptions) {
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.isCharacterBodyFrozen = options.isCharacterBodyFrozen;
  }

  evaluateInteractionProposal(
    targetCharId: string,
    initiatorId: string,
    sourceEventId: string,
  ): InteractionAcceptanceDecision {
    const snapshot = this.getCharacterSnapshot(targetCharId);

    if (snapshot?.status !== 'active') {
      return { accepted: false, reason: 'busy' };
    }

    const context = snapshot.context;

    if (
      context.target ||
      context.pendingInteractionProposal ||
      context.currentInteraction ||
      context.currentMotivation !== 'idle' ||
      this.isCharacterBodyFrozen(targetCharId)
    ) {
      return { accepted: false, reason: 'busy' };
    }

    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[sourceEventId];

    if (!definition || !this.canTargetStartInteraction(context, initiatorId, definition)) {
      return { accepted: false, reason: 'busy' };
    }

    return shouldAcceptInteraction(context, definition)
      ? { accepted: true }
      : { accepted: false, reason: 'mood' };
  }

  private canTargetStartInteraction(
    context: CharacterSnapshot['context'],
    initiatorId: string,
    definition: CharacterEventDefinition,
  ): boolean {
    return canStartInteractionWithTarget(context, definition, initiatorId, Date.now());
  }
}

