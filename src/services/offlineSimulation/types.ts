import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type { CharacterEventActivityType } from '~/constants/charactarEventsDefinitions';
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
  };
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

export type OfflinePositionPatchMode =
  | 'none'
  | 'nearbyDrift'
  | 'destination'
  | 'contained';

export interface OfflinePositionPatchPreview {
  mode: OfflinePositionPatchMode;
  reason: string;
  target?: Position;
  spaceId?: string;
}

export type OfflineResolutionPreview =
  | {
    kind: 'solo';
    statusPatch: OfflineStatusPatchPreview | null;
    positionPatch: OfflinePositionPatchPreview | null;
    currentMotivation: string;
    notes: readonly string[];
  }
  | {
    kind: 'unsupported';
    reason: string;
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
  appliedEventIds: readonly string[];
  unsupportedEventIds: readonly string[];
}

export interface OfflineRecapListItemPreview {
  eventId: string;
  characterId: string;
  characterName: string;
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
  simulationPreview: OfflineSimulationRunPreview;
  aggregatePreview: OfflineSimulationAggregatePreview;
  characters: readonly OfflineCharacterDryRun[];
}
