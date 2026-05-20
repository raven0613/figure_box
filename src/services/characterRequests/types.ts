import type { CharacterEventRuleClause } from '~/services/characterEvents/rules';
import type { SocialStatus } from '~/constants/character';
import type { ItemDefinition, ItemMatch } from '~/typing/item';

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
  targetCharacterName?: string;
  acceptedItemIds?: readonly string[];
  acceptedItemTypes?: readonly string[];
  acceptedItemTags?: readonly string[];
  itemMatch?: ItemMatch;
}

export type CharacterRequestTargetSelector =
  | {
    type: 'characterByRelationship';
    scope: 'allCharacters';
    statuses: readonly SocialStatus[];
    statusWeight?: Partial<Record<SocialStatus, number>>;
  };

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
  targetSelector?: CharacterRequestTargetSelector;
  satisfiedEffects?: readonly CharacterRequestSatisfiedEffect[];
}

export interface CharacterRequestCharacterTarget {
  characterId: string;
  characterName: string;
  socialStatus: SocialStatus;
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

export interface CharacterRequestCandidate {
  definition: CharacterRequestDefinition;
  target?: CharacterRequestTarget;
  label: string;
  weight: number;
}

export interface CharacterRequestItemMatchInput {
  characterId: string;
  itemId: string;
  itemType?: string;
  itemCategory?: string;
  itemTags?: readonly string[];
  itemDefinition?: ItemDefinition;
}

export interface CharacterRequestSocialMatchInput {
  actorId: string;
  targetCharacterId: string;
}

export interface CharacterRequestMatchResult {
  request: CharacterRequest | null;
  didChange: boolean;
}
