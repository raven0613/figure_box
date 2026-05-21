import type { Feeling, SocialStatus } from '~/constants/character';
import type { CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { JoinableActivity } from './joinableActivities';
import type {
  CharacterEventBucketId,
  CharacterEventDecision,
  CharacterUtilityScores,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';

export interface CharacterEventDecisionInput {
  nearbyCharacterIds?: string[];
  nearbyRelationships?: readonly CharacterEventNearbyRelationship[];
  nearbyJoinableActivities?: readonly JoinableActivity[];
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

export interface CharacterEventCandidate {
  id: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  event: CharacterEvent;
  weight: number;
}

export interface CharacterEventDecisionResult {
  event: CharacterEvent;
  utilityScores: CharacterUtilityScores;
  decision: CharacterEventDecision;
}
