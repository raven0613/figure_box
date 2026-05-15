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
    hungerThreshold: number;
  },
  utilityScores: CharacterUtilityScores;
  target: Position | null;
  position: Position;
  currentMotivation: CharacterMotivation;
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
  saturation?: number;
  relationships?: DirectedRelationship[];
}

export type CharacterMotivation = 'idle' | 'findFood' | 'rest' | 'play' | 'controllingByGod';
export type UtilityDrivenMotivation = Exclude<CharacterMotivation, 'controllingByGod'>;
export type CharacterUtilityScores = Record<UtilityDrivenMotivation, number>;

export interface DialogueManagerContext {
  script: DialogueScriptDocument | null;
  participants: DialogueParticipant[];
  cursor: number;
  activeChoice: DialogueChoiceInstruction | null;
  resolvedChoiceId: string | null;
}
