
import { Position } from '~/constants/character';
import { FlowStates } from './states';

export enum FlowEventType {
  GAME_START = 'Game start',
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
}

export type GameFlowEvents =
  | {
    type: FlowEventType.INITIAL;
    payload: FlowEventPayload;
  }
  | { type: 'OPEN_SYSTEM_UI' }
  | { type: 'CLOSE_SYSTEM_UI' }
  | { type: 'START_INTERACTION' }
  | { type: 'END_INTERACTION' }
  | { type: 'PICK_CHARACTER'; characterId: string }
  | { type: 'RELEASE_CHARACTER'; characterId: string };

export type CharacterEvent =
  | { type: EventType.Tick }
  | { type: EventType.GoEat; target: Position }
  | { type: EventType.GoRest }
  | { type: EventType.GoPlay }
  | { type: EventType.GoIdle }
  | { type: EventType.PickUp }
  | { type: EventType.Drop; position?: Position }
  | { type: EventType.MoveTo; target: Position }
  | { type: EventType.Arrive; position: Position }
  | { type: EventType.MoveBlocked; position?: Position }
  | { type: EventType.StartThinking }
  | { type: EventType.StopThinking };

export type CharacterEventOld =
  | { type: EventType.Tick } // 自動：時間流逝
  | { type: EventType.SenseObject; objectId: string; gridType: string } // 自動：感應到物品
  | { type: EventType.SocialProximity; targetActorId: string } // 自動：感知到附近有人
  | { type: EventType.RequestAction; actionType: 'WANT_FRIEND' | 'HUNGRY'; payload: any } // 主動：需要玩家點擊
  | { type: EventType.UserClick; actionId: string } // 主動：玩家點擊核准


export enum EventType {
  Tick = "tick", // 自動：時間流逝
  SenseObject = "senseObject", // 自動：感應到物品
  SocialProximity = "socialProximity", // 自動：感知到附近有人
  RequestAction = "requestAction", // 主動：提出需求，需要玩家點擊
  UserClick = "userClick", // 主動：玩家點擊
  GoEat = "goEat",
  GoRest = "goRest",
  GoPlay = "goPlay",
  GoIdle = "goIdle",
  PickUp = "pickUp",
  Drop = "drop",
  MoveTo = "moveTo",
  Arrive = "arrive",
  MoveBlocked = "moveBlocked",
  StartThinking = "startThinking",
  StopThinking = "stopThinking",
}
