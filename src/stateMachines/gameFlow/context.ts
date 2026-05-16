import { DirectedRelationship, Expression, Mood, Position } from "~/constants/character";
import { Item } from "~/constants/data";
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
  ownItems: Item[],
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
  currentMotivation: CharacterMotivation;
  pendingInteractionProposal: CharacterInteractionProposal | null;
  currentInteraction: CharacterInteraction | null;
  pendingActivityJoin: CharacterActivityJoinRequest | null;
  currentActivity: CharacterActivityParticipation | null;
  interactionCooldowns: CharacterInteractionCooldowns;
  relationships: DirectedRelationship[];
  locks: {
    bodyAction: string[];
    bodyMove: string[];
    mind: string[];
    communication: string[];
  };
}

// 創建角色時必須輸入的 initial data
export interface CharacterMachineInput {
  id: string;
  name: string;
  position: Position;
  ownItems?: readonly Item[];
  saturation?: number;
  relationships?: DirectedRelationship[];
}

export type CharacterMotivation = 'idle' | 'findFood' | 'rest' | 'play' | 'chat' | 'controllingByGod';
export type UtilityDrivenMotivation = Exclude<CharacterMotivation, 'controllingByGod'>;
export type CharacterUtilityScores = Record<UtilityDrivenMotivation, number>;

export interface CharacterInteractionProposal {
  id: string;
  type: 'chat' | 'play';
  targetCharId: string;
  sourceEventId: string;
}

export interface CharacterInteraction {
  id: string;
  type: 'chat' | 'play';
  partnerCharId: string;
  role: 'initiator' | 'target';
  sourceEventId: string;
}

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

export interface CharacterInteractionCooldowns {
  categoryUntilByKey: Record<string, number>;
  pairUntilByKey: Record<string, number>;
  repeatByKey: Record<string, CharacterInteractionRepeatRecord>;
}

export interface CharacterInteractionRepeatRecord {
  count: number;
  lastAt: number;
}

export type CharacterEventBucketId = 'baseline' | 'need' | 'environment' | 'global';

export interface CharacterEventDecision {
  selectedCandidateId: string | null;
  selectedBucketId: CharacterEventBucketId | null;
  selectedPresentationVariantId: string | null;
  selectedPresentationTags: string[];
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
