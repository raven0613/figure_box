import { Mood, Position } from "~/constants/character";
import { Item } from "~/constants/data";

// 放要存的資料
export interface GameFlowContext {
  nothing: any
}

// 遊戲中需讀取的必要資料
export interface CharacterContext {
  id: string;
  name: string;
  ownItems: Item[],
  status: {
    mood: Mood;
    saturation: number; // 飽足度：用長條圖顯示
    moodValue: number;
    hungerThreshold: number;
  },
  utilityScores: CharacterUtilityScores;
  target: Position | null;
  position: Position;
  currentMotivation: CharacterMotivation;
}

// 創建角色時必須輸入的 initial data
export interface CharacterMachineInput {
  id: string;
  name: string;
  position: Position;
  saturation?: number;
}

export type CharacterMotivation = 'idle' | 'findFood' | 'rest' | 'play' | 'controllingByGod';
export type UtilityDrivenMotivation = Exclude<CharacterMotivation, 'controllingByGod'>;
export type CharacterUtilityScores = Record<UtilityDrivenMotivation, number>;
