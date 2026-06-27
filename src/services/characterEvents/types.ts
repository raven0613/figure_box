import type { Feeling, SocialStatus } from '~/constants/character';
import type { CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { JoinableActivity } from './joinableActivities';
import type {
  ItemCategory,
  ItemDefinitionId,
  ItemInstanceId,
  ItemRarity,
  ItemTag,
  MapObjectId,
} from '~/typing/item';
import type {
  CharacterEventBucketId,
  CharacterEventDecision,
  CharacterUtilityScores,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';

export interface CharacterEventDecisionInput {
  nearbyCharacterIds?: string[];
  nearbyCharacterDistances?: Record<string, number>;
  nearbyRelationships?: readonly CharacterEventNearbyRelationship[];
  nearbyJoinableActivities?: readonly JoinableActivity[];
  nearbyVisibleItems?: readonly CharacterEventNearbyVisibleItem[];
  ownItemIds?: readonly string[];
  globalEventTags?: string[];
  timestamp?: number;
  random?: () => number;
}

export interface CharacterEventNearbyRelationship {
  characterId: string;
  feeling: Feeling;
  intimacy: number;
  socialStatus: SocialStatus;
}

export interface CharacterEventNearbyVisibleItem {
  placedObjectId: MapObjectId;
  itemInstanceId: ItemInstanceId;
  definitionId: ItemDefinitionId;
  category: ItemCategory;
  tags: readonly ItemTag[];
  rarity: ItemRarity;
  position: {
    x: number;
    y: number;
  };
  distance: number;
}

export interface CharacterEventCandidate {
  id: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  event: CharacterEvent;
  weight: number;
  motivationWeightMultiplier?: number;
}

export interface CharacterEventDecisionResult {
  event: CharacterEvent;
  utilityScores: CharacterUtilityScores;
  decision: CharacterEventDecision;
}
