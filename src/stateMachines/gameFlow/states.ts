export enum BigBattleGameStates {
  PREPARING = 'preparing',
  FLOW = 'flow start',
  ERROR = 'error',
}

export enum PreparingStates {
  SUCCESS = 'Success',
}

export enum FlowStates {
  JOIN = 'join',
}

export enum StartStates {
  BET_START = 'Bet start',
}

export enum RewardStates {
  START = 'Start',
  ANIMATING = 'Animating',
}

export const gameState = {
  PREPARE_WIDGET: `${BigBattleGameStates.PREPARING}.${PreparingStates.UPDATING_WIDGET}`,
  BET_START: `${BigBattleGameStates.FLOW}.${FlowStates.START}.${StartStates.BET_START}`,
};

export enum CatEnum {
  CAT1 = 'cat1',
  CAT2 = 'cat2',
  CAT3 = 'cat3',
  CAT4 = 'cat4',
  CAT5 = 'cat5',
}

export interface Payrate {
  payRate: number;
  probability?: number; // 後端會給，前端暫時用不到
}

export type Stage = BigBattleGameStates | FlowStates;
