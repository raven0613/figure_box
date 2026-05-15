import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type { Position } from '~/constants/character';
import rawCharacterEventDefinitions from '~/constants/events/characterEvents.json';
import { loadCharacterEventDefinitions } from './definitionSchema';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleClause,
  CharacterEventWeightModifier,
} from './rules';

export interface CharacterEventDefinition {
  id: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  characterEvent: CharacterEventAction;
  baseWeight: number;
  weightSource?: UtilityDrivenMotivation;
  addWeight?: number;
  maxWeight?: number;
  requiresNearbyCharacter?: boolean;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventRuleClause[];
  weightModifiers?: readonly CharacterEventWeightModifier[];
  presentationVariants?: readonly CharacterEventPresentationVariant[];
  interactionPresentation?: CharacterEventInteractionPresentation;
  acceptance?: CharacterEventAcceptance;
  cooldowns?: CharacterEventCooldowns;
  interruptPolicy?: CharacterEventInterruptPolicy;
  commitment?: number;
  onInterrupted?: readonly CharacterEventTransitionPresentation[];
  onInterruptRejected?: readonly CharacterEventTransitionPresentation[];
}

export type CharacterEventInterruptPolicy = 'none' | 'soft' | 'always' | 'critical';

export type CharacterEventAction =
  | { type: 'goIdle' }
  | { type: 'goRest' }
  | { type: 'goPlay' }
  | { type: 'goEat'; target: CharacterEventTarget }
  | { type: 'proposeChat'; target: CharacterEventInteractionTarget }
  | { type: 'proposePlay'; target: CharacterEventInteractionTarget };

export type CharacterEventTarget =
  | 'randomDestination.findFood'
  | Position;

export type CharacterEventInteractionTarget = 'randomNearbyCharacter';

export interface CharacterEventPresentationVariant {
  id: string;
  baseWeight: number;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventRuleClause[];
  weightModifiers?: readonly CharacterEventWeightModifier[];
  presentationTags?: readonly string[];
  performanceId?: string;
}

export interface CharacterEventTransitionPresentation extends CharacterEventPresentationVariant {
  dialogueGroupId?: string;
}

export interface CharacterEventInteractionPresentation {
  proposalLine?: string;
  acceptedLine?: string;
  rejectedLine?: string;
  endLine?: string;
}

export interface CharacterEventAcceptance {
  minMoodValue?: number;
  fallbackChance?: number;
}

export interface CharacterEventCooldowns {
  selfMs?: number;
  targetMs?: number;
  pairMs?: number;
  category?: string;
  repeatPenalty?: CharacterEventRepeatPenalty;
}

export interface CharacterEventRepeatPenalty {
  windowMs: number;
  weightMultiplierPerRepeat: number;
  maxRepeats?: number;
}

export const CHARACTER_EVENT_DEFINITIONS: readonly CharacterEventDefinition[] =
  loadCharacterEventDefinitions(rawCharacterEventDefinitions);

export const CHARACTER_EVENT_DEFINITIONS_BY_BUCKET = CHARACTER_EVENT_DEFINITIONS.reduce<Record<CharacterEventBucketId, CharacterEventDefinition[]>>(
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

export const CHARACTER_EVENT_DEFINITIONS_BY_ID = CHARACTER_EVENT_DEFINITIONS.reduce<Record<string, CharacterEventDefinition>>(
  (definitionsById, definition) => ({
    ...definitionsById,
    [definition.id]: definition,
  }),
  {},
);
