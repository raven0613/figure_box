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
  nearbyJoinableActivities?: readonly JoinableActivity[];
  globalEventTags?: string[];
  timestamp?: number;
  random?: () => number;
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
