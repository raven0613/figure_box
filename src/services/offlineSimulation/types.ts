import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type { CharacterEventActivityType } from '~/constants/charactarEventsDefinitions';
import type { Feeling } from '~/constants/character';
import type { Position } from '~/constants/character';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';

export type OfflineRecapMode = 'none' | 'auto' | 'always';
export type OfflineRequestMode = 'allow' | 'pendingOnly' | 'disabled';

export interface OfflineElapsedTimePolicy {
  ignoreBelowMs: number;
  maxSimulatedMs: number;
  slotDurationMs: number;
  maxSlots: number;
}

export interface OfflineEventPolicyRule {
  enabled?: boolean;
  weightMultiplier?: number;
  recap?: OfflineRecapMode;
  maxPerReturn?: number;
}

export interface OfflineRequestLevelPolicy {
  mode: OfflineRequestMode;
  weightMultiplier?: number;
  maxPerReturn?: number;
}

export interface OfflineSimulationPolicy {
  version: number;
  elapsedTime: OfflineElapsedTimePolicy;
  limits: {
    maxEventsPerCharacter: number;
    maxCandidatesPerCharacter: number;
  };
  perception: {
    nearbyCharacterFallbackRange: number;
    itemVisibilityRadius: number;
  };
  timeOfDay: {
    buckets: readonly OfflineTimeOfDayBucketPolicy[];
  };
  resolutionEffects: {
    goEatSaturationDelta: number;
    goRestMoodValueDelta: number;
    goPlayMoodValueDelta: number;
    goPlayPlayNeedDelta: number;
    homeFoodSaturationDelta: number;
    homePlayMoodValueDelta: number;
    homePlayPlayNeedDelta: number;
  };
  events: {
    default: Required<OfflineEventPolicyRule>;
    bucket: Partial<Record<CharacterEventBucketId, OfflineEventPolicyRule>>;
    motivation: Partial<Record<UtilityDrivenMotivation, OfflineEventPolicyRule>>;
    eventOverrides: Record<string, OfflineEventPolicyRule>;
  };
  requests: {
    level: Record<CharacterRequestLevel, OfflineRequestLevelPolicy>;
  };
  recap: {
    maxItems: number;
    maxDetailedItems: number;
    preferredMultiplayerItems: number;
    preferredSoloItems: number;
    displayOrder: {
      mode: OfflineRecapDisplayOrderMode;
    };
    displayScore: {
      base: number;
      multiplayerBonus: number;
      participantBonus: number;
      activityType: Partial<Record<CharacterEventActivityType, number>>;
      detailBonus: number;
      quoteBonus: number;
    };
  };
}

export type OfflineRecapDisplayOrderMode = 'timestamp' | 'timeBucketShuffle';

export interface OfflineTimeOfDayBucketPolicy {
  id: string;
  startMinute: number;
  endMinute: number;
}

export interface OfflineSimulationSlotPlan {
  index: number;
  timestamp: number;
  durationMs: number;
}

export interface OfflineSimulationPlan {
  ignored: boolean;
  elapsedMs: number;
  simulatedMs: number;
  slotCount: number;
  slots: readonly OfflineSimulationSlotPlan[];
}

export interface OfflineRecapTemplate {
  summary?: string;
  detail?: string;
  quote?: string;
  priority?: number;
  sequenceKey?: string;
  sequenceOrder?: number;
}

export interface OfflineRecapTemplates {
  version: number;
  fallback: Required<Pick<OfflineRecapTemplate, 'summary'>> & OfflineRecapTemplate;
  motivation: Partial<Record<UtilityDrivenMotivation, OfflineRecapTemplate>>;
  eventType: Record<string, OfflineRecapTemplate>;
  activityType: Partial<Record<CharacterEventActivityType, OfflineRecapTemplate>>;
  eventOverrides: Record<string, OfflineRecapTemplate>;
}

export interface ResolvedOfflineRecapTemplate {
  source: string;
  template: Required<Pick<OfflineRecapTemplate, 'summary'>> & OfflineRecapTemplate;
}

export interface OfflineRecapPreview {
  templateSource: string;
  summary: string;
  detail?: string;
  quote?: string;
  priority: number;
  sequenceKey?: string;
  sequenceOrder?: number;
}

export interface OfflineNumericPatchPreview {
  from: number;
  to: number;
  delta: number;
}

export interface OfflineStatusPatchPreview {
  saturation?: OfflineNumericPatchPreview;
  moodValue?: OfflineNumericPatchPreview;
  playNeed?: OfflineNumericPatchPreview;
}

export interface OfflineRelationshipPatchPreview {
  targetCharacterId: string;
  targetCharacterName: string;
  intimacyDelta: number;
  feelingTarget?: Feeling;
  timestamp: number;
}

export interface OfflineActivityCooldownRecordPreview {
  partnerCharacterIds: readonly string[];
  role: 'initiator' | 'target';
  sourceEventId: string;
  timestamp: number;
}

export type OfflinePositionPatchMode =
  | 'none'
  | 'nearbyDrift'
  | 'destination'
  | 'contained';

export type OfflineResolverSource =
  | `action.${string}`
  | `activity.${string}`
  | `eventOverride.${string}`;

export interface OfflinePositionPatchPreview {
  mode: OfflinePositionPatchMode;
  reason: string;
  target?: Position;
  spaceId?: string;
}

export interface OfflineParticipantResolutionPreview {
  characterId: string;
  characterName: string;
  statusPatch: OfflineStatusPatchPreview | null;
  positionPatch: OfflinePositionPatchPreview | null;
  currentMotivation: string;
  relationshipPatches: readonly OfflineRelationshipPatchPreview[];
  activityCooldownRecord: OfflineActivityCooldownRecordPreview | null;
}

export type OfflineResolutionPreview =
  | {
    kind: 'solo';
    resolverSource: OfflineResolverSource;
    statusPatch: OfflineStatusPatchPreview | null;
    positionPatch: OfflinePositionPatchPreview | null;
    currentMotivation: string;
    variables: Record<string, string>;
    notes: readonly string[];
  }
  | {
    kind: 'group';
    resolverSource: OfflineResolverSource;
    activityType: CharacterEventActivityType;
    activityKey: string;
    presentationVariantId: string;
    outcomeId?: string;
    rollSelections: Readonly<Record<string, string>>;
    participantIds: readonly string[];
    participants: readonly OfflineParticipantResolutionPreview[];
    variables: Record<string, string>;
    notes: readonly string[];
  }
  | {
    kind: 'unsupported';
    resolverSource?: OfflineResolverSource;
    reason: string;
    variables?: Record<string, string>;
  };

export interface ResolvedOfflineEventPolicy {
  enabled: boolean;
  weightMultiplier: number;
  recap: OfflineRecapMode;
  maxPerReturn: number;
}

export interface OfflineCharacterCandidateDebug {
  id: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  onlineWeight: number;
  offlineWeight: number;
  policy: ResolvedOfflineEventPolicy;
  eventType: string;
  activityType?: CharacterEventActivityType;
  recapPreview: OfflineRecapPreview | null;
  resolutionPreview: OfflineResolutionPreview;
}

export interface OfflineSimulationPreviewEvent {
  slotIndex: number;
  timestamp: number;
  characterId: string;
  characterName: string;
  eventId: string;
  bucketId: CharacterEventBucketId;
  motivation: UtilityDrivenMotivation;
  eventType: string;
  activityType?: CharacterEventActivityType;
  offlineWeight: number;
  recapPreview: OfflineRecapPreview | null;
  resolutionPreview: OfflineResolutionPreview;
}

export interface OfflineSimulationPreviewSuppressedEvent {
  slotIndex: number;
  timestamp: number;
  characterId: string;
  eventId: string;
  reason: string;
}

export interface OfflineSimulationRunPreview {
  seed: string;
  events: readonly OfflineSimulationPreviewEvent[];
  suppressed: readonly OfflineSimulationPreviewSuppressedEvent[];
}

export interface OfflineFinalCharacterStatePreview {
  characterId: string;
  characterName: string;
  statusPatch: OfflineStatusPatchPreview | null;
  position: {
    from: Position;
    to: Position;
    mode: OfflinePositionPatchMode;
    reason: string;
  } | null;
  presence: {
    from: string;
    to: string;
    kind: 'positioned' | 'contained';
  } | null;
  relationshipPatches: readonly OfflineRelationshipPatchPreview[];
  activityCooldownRecords: readonly OfflineActivityCooldownRecordPreview[];
  appliedEventIds: readonly string[];
  unsupportedEventIds: readonly string[];
}

export interface OfflineRecapListItemPreview {
  eventId: string;
  characterId: string;
  characterName: string;
  participantIds: readonly string[];
  participantNames: readonly string[];
  timestamp: number;
  summary: string;
  detail?: string;
  quote?: string;
  hasDetail: boolean;
}

export interface OfflineApplyReadinessPreview {
  canApplyAll: boolean;
  eventCount: number;
  supportedEventCount: number;
  unsupportedEventCount: number;
  unsupportedEventIds: readonly string[];
}

export interface OfflineSimulationAggregatePreview {
  finalStateByCharacterId: Record<string, OfflineFinalCharacterStatePreview>;
  recapListPreview: readonly OfflineRecapListItemPreview[];
  applyReadiness: OfflineApplyReadinessPreview;
}

export interface OfflineBaselineCharacterPreview {
  characterId: string;
  characterName: string;
  changed: boolean;
  clearedLocks: {
    bodyAction: readonly string[];
    bodyMove: readonly string[];
    mind: readonly string[];
    communication: readonly string[];
  };
  position: {
    from: Position;
    to: Position;
    reason: string;
  } | null;
  presence: {
    from: string;
    to: string;
    kind: 'positioned' | 'contained';
    reason: string;
  } | null;
  notes: readonly string[];
}

export interface OfflineBaselinePreview {
  settlementPolicy: 'committedOnly';
  normalizedCharacterCount: number;
  characters: readonly OfflineBaselineCharacterPreview[];
}

export interface OfflineCharacterDryRun {
  characterId: string;
  characterName: string;
  elapsedMs: number;
  ignoredByElapsedTime: boolean;
  candidateCount: number;
  candidates: readonly OfflineCharacterCandidateDebug[];
}

export interface OfflineSimulationDryRun {
  generatedAt: number;
  lastActiveAt: number | null;
  elapsedMs: number | null;
  policyVersion: number;
  plan: OfflineSimulationPlan;
  baselinePreview: OfflineBaselinePreview;
  simulationPreview: OfflineSimulationRunPreview;
  aggregatePreview: OfflineSimulationAggregatePreview;
  characters: readonly OfflineCharacterDryRun[];
}
