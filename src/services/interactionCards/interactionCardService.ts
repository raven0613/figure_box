import {
  CHARACTER_EVENT_DEFINITIONS,
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventCardDefinition,
  type CharacterEventDefinition,
} from '~/constants/charactarEventsDefinitions';

export interface InteractionCardViewModel {
  id: string;
  eventId: string;
  label: string;
  promptTemplate: string;
  participantMode: CharacterEventCardDefinition['participantMode'];
  performanceId: string;
}

export interface InteractionCardUseIntent {
  cardId: string;
  initiatorId: string;
  targetId: string;
}

export interface InteractionCardUseResolution {
  cardId: string;
  eventId: string;
  initiatorId: string;
  targetId: string;
  performanceId: string;
  promptTemplate: string;
}

class InteractionCardService {
  getAvailableCards(): readonly InteractionCardViewModel[] {
    return CHARACTER_EVENT_DEFINITIONS
      .filter(hasCardDefinition)
      .map(definition => this.createCardViewModel(definition));
  }

  resolveCardUse(intent: InteractionCardUseIntent): InteractionCardUseResolution | null {
    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[intent.cardId];

    if (!definition?.card) {
      return null;
    }

    if (intent.initiatorId === intent.targetId) {
      return null;
    }

    return {
      cardId: definition.id,
      eventId: definition.id,
      initiatorId: intent.initiatorId,
      targetId: intent.targetId,
      performanceId: definition.card.performanceId,
      promptTemplate: definition.card.promptTemplate,
    };
  }

  private createCardViewModel(
    definition: CharacterEventDefinition & { card: CharacterEventCardDefinition },
  ): InteractionCardViewModel {
    return {
      id: definition.id,
      eventId: definition.id,
      label: definition.card.label,
      promptTemplate: definition.card.promptTemplate,
      participantMode: definition.card.participantMode,
      performanceId: definition.card.performanceId,
    };
  }
}

function hasCardDefinition(
  definition: CharacterEventDefinition,
): definition is CharacterEventDefinition & { card: CharacterEventCardDefinition } {
  return definition.card !== undefined;
}

export const interactionCardService = new InteractionCardService();
