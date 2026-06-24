import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type {
  Feeling,
  MemoryType,
  Mood,
  Position,
  SocialStatus,
} from '~/constants/character';
import rawCharacterEventDefinitions from '~/constants/events/characterEvents.json';
import { loadCharacterEventDefinitions } from '../utils/jsonParser/definitionSchema';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleClause,
  CharacterEventRuleValue,
  CharacterEventWeightModifier,
} from '../services/characterEvents/rules';
import type { ComparisonOperator } from '~/constants/event';
import type { OfflineRecapTemplate } from '~/services/offlineSimulation/types';

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
  acceptance?: CharacterEventAcceptance;
  interruptPolicy?: CharacterEventInterruptPolicy;
  commitment?: number;
  card?: CharacterEventCardDefinition;
  offlineRecap?: OfflineRecapTemplate;
  onInterrupted?: readonly CharacterEventTransitionPresentation[];
  onInterruptRejected?: readonly CharacterEventTransitionPresentation[];
}

export type CharacterEventInterruptPolicy = 'none' | 'soft' | 'always' | 'critical';

export type CharacterEventAction =
  | { type: 'goIdle' }
  | { type: 'goRest' }
  | { type: 'goPlay' }
  | { type: 'goHome' }
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

export type CharacterEventActivityTarget = 'nearbyJoinableActivity';

export interface CharacterEventPresentationVariant {
  id: string;
  baseWeight: number;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventRuleClause[];
  weightModifiers?: readonly CharacterEventWeightModifier[];
  presentationTags?: readonly string[];
  performanceId?: string;
  offlineRecap?: OfflineRecapTemplate;
  activity?: CharacterEventActivity;
}

export interface CharacterEventTransitionPresentation extends CharacterEventPresentationVariant {
  dialogueGroupId?: string;
}

export type CharacterEventCardParticipantMode = 'initiatorTarget';

export interface CharacterEventCardDefinition {
  label: string;
  promptTemplate: string;
  participantMode: CharacterEventCardParticipantMode;
  performanceId: string;
}

export interface CharacterEventAcceptance {
  minMoodValue?: number;
  allowedMoods?: readonly Mood[];
  relationships?: readonly CharacterEventRelationshipAcceptance[];
  baseChance?: number;
  fallbackChance?: number;
  weightModifiers?: readonly CharacterEventWeightModifier[];
}

export interface CharacterEventRelationshipAcceptance {
  minIntimacy?: number;
  maxIntimacy?: number;
  allowedFeelings?: readonly Feeling[];
  allowedSocialStatuses?: readonly SocialStatus[];
}

export interface CharacterEventActivity {
  key: string;
  type: CharacterEventActivityType;
  startPhase?: CharacterEventActivityStartPhase;
  destination?: CharacterEventActivityDestination;
  availability?: CharacterEventActivityAvailability;
  group: CharacterEventGroupActivity;
  joinable?: boolean;
  durationMs: number;
  refreshDurationOnJoin?: boolean;
  joinWindowMs?: number;
  joinRequirements?: CharacterEventJoinRequirement;
  cooldowns: CharacterEventCooldowns;
  effects?: CharacterEventActivityEffects;
  effectsByRole?: CharacterEventActivityEffectsByRole;
  dialogueScriptId?: string;
  dialogueSubjectSelection?: CharacterEventDialogueSubjectSelection;
  rolls?: readonly CharacterEventActivityRoll[];
}

export type CharacterEventActivityType = 'chat' | 'playWithItem' | 'playAtLocation';
export type CharacterEventActivityStartPhase = 'active' | 'traveling';
export type CharacterEventActivityDestination =
  | 'randomDestination.play'
  | 'randomDestination.coffee'
  | 'randomDestination.sketch'
  | 'randomDestination.jogging'
  | 'randomDestination.photography'
  | Position;

export interface CharacterEventGroupActivity {
  inviteNearbyRange?: number;
  minParticipants?: number;
  maxParticipants?: number;
}

export interface CharacterEventActivityAvailability {
  timeOfDay?: readonly string[];
  timeWindows?: readonly CharacterEventActivityTimeWindow[];
}

export interface CharacterEventActivityTimeWindow {
  fromMinute: number;
  toMinute: number;
}

export type CharacterEventItemJoinRequirementScope = 'joiner' | 'host';

export type CharacterEventJoinRequirement =
  | { type: 'none' }
  | {
      type: 'hasItem';
      itemId: string;
      scope?: CharacterEventItemJoinRequirementScope;
    };

// 活動造成的效果
export interface CharacterEventActivityEffects {
  relationshipIntimacyDelta?: number;
  relationshipFeelingTarget?: Feeling;
  moodValueDelta?: number;
  moodStageTarget?: Mood;
  playNeedDelta?: number;
}

export interface CharacterEventActivityEffectsByRole {
  initiator?: CharacterEventActivityEffects;
  target?: CharacterEventActivityEffects;
}

export interface CharacterEventDialogueSubjectSelection {
  sourceRole: CharacterEventParticipantRole;
  memoryType: MemoryType;
  minCount: number;
  count: number;
  excludeParticipants: boolean;
}

export type CharacterEventParticipantRole = 'initiator' | 'target';

export interface CharacterEventActivityMemoryEffect {
  recipientRole: CharacterEventParticipantRole | 'both';
  target: 'otherParticipant' | 'dialogueSubject';
  memoryType: MemoryType;
  countDelta: number;
  startedByRole?: CharacterEventParticipantRole;
}

export type CharacterEventActivityRollRulePath =
  | `initiator.${string}`
  | `target.${string}`
  | `activity.${string}`;

export interface CharacterEventActivityRollRuleClause {
  path: CharacterEventActivityRollRulePath;
  operator: ComparisonOperator;
  value: CharacterEventRuleValue;
}

export interface CharacterEventActivityRollWeightModifier
  extends CharacterEventActivityRollRuleClause {
  add?: number;
  multiplier?: number;
}

export interface CharacterEventActivityRollBranch {
  id: string;
  baseWeight: number;
  resolvesActivity?: boolean;
  conditionMode?: CharacterEventClauseMode;
  conditions?: readonly CharacterEventActivityRollRuleClause[];
  weightModifiers?: readonly CharacterEventActivityRollWeightModifier[];
  performanceId?: string;
  effects?: CharacterEventActivityEffects;
  effectsByRole?: CharacterEventActivityEffectsByRole;
  memoryEffects?: readonly CharacterEventActivityMemoryEffect[];
  offlineRecap?: OfflineRecapTemplate;
}

export interface CharacterEventActivityRoll {
  id: string;
  resolvesActivity?: boolean;
  branches: readonly CharacterEventActivityRollBranch[];
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
