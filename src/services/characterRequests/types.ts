import type { CharacterEventRuleClause } from '~/services/characterEvents/rules';

export type CharacterRequestLevel = 'critical' | 'social' | 'minor';
export type CharacterRequestKind =
  | 'food'
  | 'meetCharacter'
  | 'talkToCharacter'
  | 'relationshipMilestone'
  | 'item'
  | 'roomDecor'
  | 'mapObject';
export type CharacterRequestStatus = 'active' | 'resolving';

export interface CharacterRequestTarget {
  targetCharacterId?: string;
  acceptedItemIds?: readonly string[];
  acceptedItemTypes?: readonly string[];
  acceptedItemTags?: readonly string[];
}

export type CharacterRequestSatisfiedEffect =
  | { type: 'characterMoodValueDelta'; value: number }
  | { type: 'characterSaturationDelta'; value: number }
  | { type: 'playerInventoryItem'; itemId: string; amount: number };

export interface CharacterRequestDefinition {
  id: string;
  level: CharacterRequestLevel;
  kind: CharacterRequestKind;
  label: string;
  baseChance: number;
  conditions?: readonly CharacterEventRuleClause[];
  conditionMode?: 'all' | 'some';
  target?: CharacterRequestTarget;
  satisfiedEffects?: readonly CharacterRequestSatisfiedEffect[];
}

export interface CharacterRequest {
  id: string;
  definitionId: string;
  characterId: string;
  level: CharacterRequestLevel;
  kind: CharacterRequestKind;
  status: CharacterRequestStatus;
  label: string;
  target?: CharacterRequestTarget;
  satisfiedEffects?: readonly CharacterRequestSatisfiedEffect[];
  createdAt: number;
  expiresAt: number | null;
}

export interface CharacterRequestGenerationResult {
  request: CharacterRequest | null;
  didChange: boolean;
}

export interface CharacterRequestItemMatchInput {
  characterId: string;
  itemId: string;
  itemType?: string;
  itemTags?: readonly string[];
}

export interface CharacterRequestSocialMatchInput {
  actorId: string;
  targetCharacterId: string;
}

export interface CharacterRequestMatchResult {
  request: CharacterRequest | null;
  didChange: boolean;
}
