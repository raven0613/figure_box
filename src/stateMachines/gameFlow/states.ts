export enum GameState {
  Loading = "loading",
  Active = "active",
  Error = "error"
}
// user 觸發 UI 行為
export enum GameSystemState {
  Null = "null",
  Operating = "operating", // 操作系統中，可當作最高級，即使原本在上帝干預中，打開了系統，遊戲世界中的上帝干預狀態還是存在著
}

// 指 user 觸發關於遊戲的行為
export enum GameGodState {
  Normal = "normal",
  Interaction = "interaction", // 上帝干預中，例如抓著某人、跳出選項中
}

// 以下四個人物狀態平行，因為希望能做出組合動作，動畫系統可以直接根據這兩個軌道做混合。例如，身體拿躺著的圖，手上改成拿手機
// 角色動作 state
export enum CharacterBodyActionState {
  Idle = "idle", // 閒置
  Observing = "observing", // 觀察地圖上的物件中
  Operating = "operating", // 操作物品中，為父狀態，子狀態可以有很多例如吃飯、滑手機
  PickedUp = "pickedUp", // 被提起中
  Socializing = "socializing", // 社交中
}
// 角色移動 state
export enum CharacterBodyMoveState {
  Stand = "stand", // 閒置
  Lie = "lie", // 躺著
  Sit = "sit",
  Walking = "walking", // 需處理座標位移
  Running = "running",
  fallDown = "fallDown" // 跌倒
}
export enum CharacterMindState {
  Null = "null", // 閒置
  Thinking = "thinking", // 思考中
}
export enum CharacterCommunicationState {
  Null = "null", // 閒置
  Requesting = "requesting", // 主動向 user 發出信號（代表可以一邊做事一邊提需求）
}
export enum CharacterControlState {
  Normal = "normal",
  RequestFulfillment = "requestFulfillment",
  RelationshipMoment = "relationshipMoment",
  Dialogue = "dialogue",
  SpaceTransition = "spaceTransition",
}

export interface CharacterStateSummary {
  bodyAction: CharacterBodyActionState;
  bodyMove: CharacterBodyMoveState;
  mind: CharacterMindState;
  communication: CharacterCommunicationState;
  control: CharacterControlState;
}


export enum PreparingStates {
  SUCCESS = "success",
}

export enum FlowStates {
  INITIAL = "initial",
  JOIN = "join",
  START = "start",
  STOP = "stop",
  REWARD = "reward",
  FINISHED = "finished",
}

export const BigBattleGameStates = {
  PREPARING: GameState.Loading,
  FLOW: GameState.Active,
  ERROR: GameState.Error,
} as const;

export type Stage = GameState | (typeof BigBattleGameStates)[keyof typeof BigBattleGameStates];
