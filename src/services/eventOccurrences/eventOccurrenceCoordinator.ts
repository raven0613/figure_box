import type { Position } from '~/constants/character';
import { WORLD_EVENT_DEFINITIONS_BY_ID } from '~/constants/worldEventDefinitions';
import type { EventOccurrence, WorldEventDefinition } from './worldEventTypes';

interface PlayTransientEventPerformanceInput {
  eventId: string;
  characterId: string;
  performanceId: string;
  timestamp: number;
}

interface EventOccurrenceCoordinatorOptions {
  getCharacterIdsNearPosition: (position: Position, radius: number) => readonly string[];
  playTransientPerformance: (input: PlayTransientEventPerformanceInput) => void;
}

export class EventOccurrenceCoordinator {
  private readonly getCharacterIdsNearPosition: (position: Position, radius: number) => readonly string[];
  private readonly playTransientPerformance: (input: PlayTransientEventPerformanceInput) => void;

  constructor(options: EventOccurrenceCoordinatorOptions) {
    this.getCharacterIdsNearPosition = options.getCharacterIdsNearPosition;
    this.playTransientPerformance = options.playTransientPerformance;
  }

  dispatchEventOccurrence(occurrence: EventOccurrence): void {
    const definition = WORLD_EVENT_DEFINITIONS_BY_ID[occurrence.eventId];

    if (!definition) {
      return;
    }

    const timestamp = Date.now();

    this.resolveAudience(definition, occurrence).forEach(characterId => {
      this.playTransientPerformance({
        eventId: occurrence.eventId,
        characterId,
        performanceId: definition.characterReaction.performanceId,
        timestamp,
      });
    });
  }

  private resolveAudience(
    definition: WorldEventDefinition,
    occurrence: EventOccurrence,
  ): readonly string[] {
    if (definition.audience.type === 'nearbyCharacters' && occurrence.position) {
      return this.getCharacterIdsNearPosition(occurrence.position, definition.audience.radius);
    }

    return [];
  }
}
