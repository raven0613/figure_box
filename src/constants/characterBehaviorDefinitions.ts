import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import rawCharacterBehaviorDefinitions from '~/constants/events/characterBehaviors.json';
import { loadCharacterBehaviorDefinitions } from '~/utils/jsonParser/behaviorSchema';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleClause,
  CharacterEventWeightModifier,
} from '~/services/characterEvents/rules';

export type CharacterBehaviorType = 'stroll' | 'idleMoment' | 'observe' | 'sit';
export type CharacterBehaviorTarget = 'randomMap' | 'nearbyObservableObject';

export const OBSERVE_OBJECT_BEHAVIOR_ID = 'behavior.observeVisibleItem';

export interface CharacterBehaviorDefinition {
  id: string;
  label?: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  type: CharacterBehaviorType;
  baseWeight: number;
  weightSource?: UtilityDrivenMotivation;
  addWeight?: number;
  maxWeight?: number;
  tickable: boolean;
  durationMs?: number;
  target?: CharacterBehaviorTarget;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventRuleClause[];
  weightModifiers?: readonly CharacterEventWeightModifier[];
  presentationTags?: readonly string[];
}

export const CHARACTER_BEHAVIOR_DEFINITIONS: readonly CharacterBehaviorDefinition[] =
  loadCharacterBehaviorDefinitions(rawCharacterBehaviorDefinitions);

export const CHARACTER_BEHAVIOR_DEFINITIONS_BY_BUCKET =
  CHARACTER_BEHAVIOR_DEFINITIONS.reduce<Record<CharacterEventBucketId, CharacterBehaviorDefinition[]>>(
    (definitionsByBucket, definition) => ({
      ...definitionsByBucket,
      [definition.bucketId]: [
        ...definitionsByBucket[definition.bucketId],
        definition,
      ],
    }),
    {
      baseline: [],
      need: [],
      environment: [],
      global: [],
    },
  );

export const CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID =
  CHARACTER_BEHAVIOR_DEFINITIONS.reduce<Record<string, CharacterBehaviorDefinition>>(
    (definitionsById, definition) => ({
      ...definitionsById,
      [definition.id]: definition,
    }),
    {},
  );
