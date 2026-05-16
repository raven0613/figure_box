import { Expression, Position } from "~/constants/character";
import type { JoinableActivity } from "~/services/characterEvents/joinableActivities";
import { DialogueChoiceInstruction, DialogueParticipant, DialogueScriptDocument } from "~/typing/dialogue";

export enum WidgetEventType {
  INITIAL = 'Initial',
  UPDATE = 'Update',
}

export type GameFlowEvents =
  | { type: 'OPEN_SYSTEM_UI' }
  | { type: 'CLOSE_SYSTEM_UI' }
  | { type: 'START_INTERACTION' }
  | { type: 'END_INTERACTION' }
  | { type: 'PICK_CHARACTER'; characterId: string }
  | { type: 'RELEASE_CHARACTER'; characterId: string }
  | DialogueManagerEvent;

export type CharacterEvent =
  | {
    type: EventType.Tick;
    nearbyCharacterIds?: string[];
    nearbyJoinableActivities?: readonly JoinableActivity[];
    globalEventTags?: string[];
    timestamp?: number;
    allowAutonomousDecision?: boolean;
  }
  | { type: EventType.PassBy; targetCharId: string; timestamp?: number }
  | { type: EventType.GoEat; target: Position }
  | { type: EventType.GoRest }
  | { type: EventType.GoPlay }
  | { type: EventType.ProposeChat; targetCharId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.ProposePlay; targetCharId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.StartActivity; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivity; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivityAccepted; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivityRejected; activityId: string }
  | { type: EventType.EndJoinedActivity; activityId: string; timestamp?: number }
  | { type: EventType.ChatProposalAccepted; targetCharId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.ChatProposalRejected; targetCharId: string; proposalId: string; timestamp?: number }
  | { type: EventType.AcceptChatProposal; fromCharacterId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.PlayProposalAccepted; targetCharId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.PlayProposalRejected; targetCharId: string; proposalId: string; timestamp?: number }
  | { type: EventType.AcceptPlayProposal; fromCharacterId: string; proposalId: string; sourceEventId: string }
  | { type: EventType.EndChatInteraction; proposalId: string; timestamp?: number }
  | { type: EventType.EndPlayInteraction; proposalId: string; timestamp?: number }
  | {
    type: EventType.RecordInteractionCooldown;
    interactionType: 'chat' | 'play';
    partnerCharId: string;
    proposalId: string;
    role: 'initiator' | 'target';
    sourceEventId: string;
    timestamp?: number;
  }
  | { type: EventType.GoIdle }
  | { type: EventType.PickUp }
  | { type: EventType.Drop; position?: Position }
  | { type: EventType.MoveTo; target: Position }
  | { type: EventType.Arrive; position: Position }
  | { type: EventType.MoveBlocked; position?: Position }
  | { type: EventType.StartThinking }
  | { type: EventType.StopThinking }
  | { type: EventType.SetExpression; expression: Expression }
  | { type: EventType.AddLock; parts: ('bodyAction' | 'bodyMove' | 'mind' | 'communication')[]; reason: string }
  | { type: EventType.RemoveLock; parts: ('bodyAction' | 'bodyMove' | 'mind' | 'communication')[]; reason: string };

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
  PassBy = "passBy", // 自動：擦肩而過
  GoEat = "goEat",
  GoRest = "goRest",
  GoPlay = "goPlay",
  ProposeChat = "proposeChat",
  ProposePlay = "proposePlay",
  StartActivity = "startActivity",
  JoinActivity = "joinActivity",
  JoinActivityAccepted = "joinActivityAccepted",
  JoinActivityRejected = "joinActivityRejected",
  EndJoinedActivity = "endJoinedActivity",
  ChatProposalAccepted = "chatProposalAccepted",
  ChatProposalRejected = "chatProposalRejected",
  AcceptChatProposal = "acceptChatProposal",
  PlayProposalAccepted = "playProposalAccepted",
  PlayProposalRejected = "playProposalRejected",
  AcceptPlayProposal = "acceptPlayProposal",
  EndChatInteraction = "endChatInteraction",
  EndPlayInteraction = "endPlayInteraction",
  RecordInteractionCooldown = "recordInteractionCooldown",
  GoIdle = "goIdle",
  PickUp = "pickUp",
  Drop = "drop",
  MoveTo = "moveTo",
  Arrive = "arrive",
  MoveBlocked = "moveBlocked",
  StartThinking = "startThinking",
  StopThinking = "stopThinking",
  SetExpression = "setExpression",
  AddLock = "addLock",
  RemoveLock = "removeLock",
}

export type DialogueManagerEvent =
  | {
    type: 'START_DIALOGUE';
    script: DialogueScriptDocument;
    participants: DialogueParticipant[];
  }
  | {
    type: 'RESOLVE';
    choiceId: string;
  }
  | {
    type: 'CANCEL_DIALOGUE';
  };

export type DialogueManagerEmittedEvent =
  | {
    type: 'DIALOGUE_LINE';
    speakerId: string;
    text: string;
    expression?: Expression;
  }
  | {
    type: 'DIALOGUE_CHOICE_REQUESTED';
    choice: DialogueChoiceInstruction;
    participantIds: string[];
  }
  | {
    type: 'DIALOGUE_CHOICE_RESOLVED';
    choiceId: string;
    participantIds: string[];
  }
  | {
    type: 'DIALOGUE_CHARACTER_EVENT';
    characterId: string;
    event: CharacterEvent;
  }
  | {
    type: 'DIALOGUE_ENDED';
    scriptId: string | null;
    participantIds: string[];
  };
