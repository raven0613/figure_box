import { DirectedRelationship, Expression, Mood, Position } from "~/constants/character";
import type { ItemDefinitionId, ItemInstanceId, CharacterSeedItem } from "~/typing/item";
import type { CharacterControlState } from "./states";
import type { RelationshipStore } from "./relationships";
import { DialogueChoiceInstruction, DialogueParticipant, DialogueScriptDocument } from "~/typing/dialogue";

// 放要存的資料
export interface GameFlowContext {
  relationships: RelationshipStore;
}

// 遊戲中需讀取的必要資料
export interface CharacterContext {
  id: string;
  name: string;
  ownItems: CharacterSeedItem[],
  status: {
    mood: Mood;
    expression: Expression;
    saturation: number; // 飽足度：用長條圖顯示
    moodValue: number;
    playNeed: number;
    hungerThreshold: number;
  },
  utilityScores: CharacterUtilityScores;
  lastEventDecision: CharacterEventDecision | null;
  target: Position | null;
  position: Position;
  presence: CharacterPresence;
  currentMotivation: CharacterMotivation;
  controlState: CharacterControlState;
  pendingActivityJoin: CharacterActivityJoinRequest | null;
  currentActivity: CharacterActivityParticipation | null;
  heldItem: CharacterHeldItem | null;
  activityCooldowns: CharacterActivityCooldowns;
  relationships: DirectedRelationship[];
  locks: {
    bodyAction: string[];
    bodyMove: string[];
    mind: string[];
    communication: string[];
  };
}

export type CharacterPresence =
  | {
    kind: 'positioned';
    spaceId: string;
    position: Position;
  }
  | {
    kind: 'contained';
    spaceId: string;
  };

export interface CharacterRuntimeInput {
  status: CharacterContext['status'];
  position: Position;
  presence: CharacterPresence;
  heldItem: CharacterHeldItem | null;
  activityCooldowns: CharacterActivityCooldowns;
  locks: CharacterContext['locks'];
  relationships: DirectedRelationship[];
}

// 創建角色時必須輸入的 initial data
export interface CharacterMachineInput {
  id: string;
  name: string;
  position: Position;
  ownItems?: readonly CharacterSeedItem[];
  saturation?: number;
  relationships?: DirectedRelationship[];
  heldItem?: CharacterHeldItem | null;
  runtime?: CharacterRuntimeInput;
}

export type CharacterMotivation = 'idle' | 'findFood' | 'rest' | 'play' | 'chat' | 'goHome' | 'controllingByGod';
export type UtilityDrivenMotivation = Exclude<CharacterMotivation, 'controllingByGod'>;
export type CharacterUtilityScores = Record<UtilityDrivenMotivation, number>;

export interface CharacterActivityJoinRequest {
  id: string;
  activityId: string;
  sourceEventId: string;
}

export interface CharacterActivityParticipation {
  id: string;
  activityId: string;
  sourceEventId: string;
}

export interface CharacterHeldItem {
  itemInstanceId: ItemInstanceId;
  definitionId: ItemDefinitionId;
}

export interface CharacterActivityCooldowns {
  categoryUntilByKey: Record<string, number>;
  pairUntilByKey: Record<string, number>;
  repeatByKey: Record<string, CharacterActivityRepeatRecord>;
}

export interface CharacterActivityRepeatRecord {
  count: number;
  lastAt: number;
}

export type CharacterEventBucketId = 'baseline' | 'need' | 'environment' | 'global';

export interface CharacterEventDecision {
  selectedMotivation: UtilityDrivenMotivation | null;
  selectedCandidateId: string | null;
  selectedBucketId: CharacterEventBucketId | null;
  selectedPresentationVariantId: string | null;
  selectedPresentationTags: string[];
  motivationCount: number;
  selectedMotivationCandidateCount: number;
  candidateCount: number;
  bucketIds: CharacterEventBucketId[];
}

export interface DialogueManagerContext {
  script: DialogueScriptDocument | null;
  participants: DialogueParticipant[];
  cursor: number;
  activeChoice: DialogueChoiceInstruction | null;
  resolvedChoiceId: string | null;
}
