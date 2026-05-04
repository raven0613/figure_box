
import { CatEnum, FlowStates } from './states';

export enum FlowEventType {
  GAME_START = 'Game start',
  BET_TIMES_OUT = 'Bet times out',
  RACE = 'Race',
  REWARD = 'Reward',
  GAME_FINISHED = 'Game finished',
  RESTART = 'Game restart',
  INITIAL = 'Game Initial',
  SOCKET_HEARTBEAT_STOP = 'Socket heartbeat stop',
  USER_NETWORK_DOWN = 'User network down',
  MULTI_CONNECTION_ERROR = 'Multi connections occur',
}

export enum WidgetEventType {
  INITIAL = 'Initial',
  UPDATE = 'Update',
}

export interface FlowEventPayload {
  gameRoundId: string;
  status: FlowStates;
  startTimeStamp: number;
  currentStageTimeStamp: number;
  nextStageTimeStamp: number;
  winner: CatEnum;
  payRates?: Record<CatEnum, number>;
}

export type GameFlowEvents =
  | {
    type: FlowEventType.INITIAL;
    payload: FlowEventPayload;
  }
  | {
    type: FlowEventType.MULTI_CONNECTION_ERROR;
  };

export const flowEventByServerState: { [key in FlowStates]?: FlowEventType } = {
  [FlowStates.INITIAL]: FlowEventType.RESTART,
  [FlowStates.START]: FlowEventType.GAME_START,
  [FlowStates.STOP]: FlowEventType.BET_TIMES_OUT,
  [FlowStates.REWARD]: FlowEventType.REWARD,
  [FlowStates.FINISHED]: FlowEventType.GAME_FINISHED,
};
