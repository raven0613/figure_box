import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type { Feeling, Mood, Position } from '~/constants/character';
import rawCharacterEventDefinitions from '~/constants/events/characterEvents.json';
import { loadCharacterEventDefinitions } from '../utils/jsonParser/definitionSchema';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleClause,
  CharacterEventWeightModifier,
} from '../services/characterEvents/rules';

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
  | { type: 'startActivity' }
  | {
    type: 'joinActivity';
    target: CharacterEventActivityTarget;
    motivation?: UtilityDrivenMotivation;
  };

export type CharacterEventTarget =
  | 'randomDestination.findFood'
  | Position;

export type CharacterEventInviteTarget = 'randomNearbyCharacter';
export type CharacterEventActivityTarget = 'nearbyJoinableActivity';

export interface CharacterEventPresentationVariant {
  id: string;
  baseWeight: number;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventRuleClause[];
  weightModifiers?: readonly CharacterEventWeightModifier[];
  presentationTags?: readonly string[];
  performanceId?: string;
  activity?: CharacterEventActivity;
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
  allowedMoods?: readonly Mood[];
  fallbackChance?: number;
}

export interface CharacterEventActivity {
  key: string;
  type: CharacterEventActivityType;
  startPhase?: CharacterEventActivityStartPhase;
  destination?: CharacterEventActivityDestination;
  invite?: CharacterEventActivityInvite;
  group?: CharacterEventGroupActivity;
  joinable?: boolean;
  durationMs: number;
  refreshDurationOnJoin?: boolean;
  joinWindowMs?: number;
  joinRequirements?: CharacterEventJoinRequirement;
  effects?: CharacterEventActivityEffects;
}

export type CharacterEventActivityType = 'chat' | 'playWithItem' | 'playAtLocation';
export type CharacterEventActivityStartPhase = 'inviting' | 'active' | 'traveling';
export type CharacterEventActivityDestination =
  | 'randomDestination.play'
  | Position;

export interface CharacterEventActivityInvite {
  target: CharacterEventInviteTarget;
  range?: number;
  requiredAcceptCount?: number;
}

export interface CharacterEventGroupActivity {
  inviteNearbyRange?: number;
  maxParticipants?: number;
}

export type CharacterEventJoinRequirement =
  | { type: 'none' }
  | { type: 'hasItem'; itemId: string };

// 活動造成的效果
export interface CharacterEventActivityEffects {
  relationshipIntimacyDelta?: number;
  relationshipFeelingTarget?: Feeling;
  moodValueDelta?: number;
  moodStageTarget?: Mood;
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
