import type { Position } from '~/constants/character';

export interface WorldEventDefinition {
  id: string;
  audience: WorldEventAudienceDefinition;
  characterReaction: {
    performanceId: string;
  };
}

export interface WorldEventAudienceDefinition {
  type: 'nearbyCharacters';
  radius: number;
}

export interface EventOccurrence {
  eventId: string;
  sourceActorId?: string;
  position?: Position;
  payload?: Record<string, unknown>;
}
