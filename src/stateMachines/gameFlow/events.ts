import { ExpressionPresetId, MemoryType, Position } from "~/constants/character";
import type { CharacterEventActivityEffects } from "~/constants/charactarEventsDefinitions";
import type { CharacterRequestSatisfiedEffect } from "~/services/characterRequests/types";
import type { CharacterRuntimeInput } from "./context";
import type { CharacterControlReason } from "./controlReasons";
import type { CharacterControlState } from "./states";
import type { ItemDefinitionId, ItemInstanceId } from "~/typing/item";
import type {
  CharacterEventNearbyRelationship,
  CharacterEventNearbyVisibleItem,
} from "~/services/characterEvents/types";
import type { JoinableActivity } from "~/services/characterEvents/joinableActivities";
import type { ActivityOutcomeResolvedBy } from "~/services/characterEvents/activityOutcomeResolver";
import { DialogueChoiceInstruction, DialogueParticipant, DialogueScriptDocument } from "~/typing/dialogue";

export enum WidgetEventType {
  INITIAL = 'Initial',
  UPDATE = 'Update',
}

export type GameFlowEvents =
  | { type: 'LOADING_COMPLETE' }
  | { type: 'LOADING_FAILED' }
  | { type: 'OPEN_SYSTEM_UI' }
  | { type: 'CLOSE_SYSTEM_UI' }
  | { type: 'START_INTERACTION' }
  | { type: 'END_INTERACTION' }
  | { type: 'PICK_CHARACTER'; characterId: string }
  | { type: 'RELEASE_CHARACTER'; characterId: string }
  | SimWorldEvent
  | DialogueManagerEvent;

export type SimWorldEvent =
  | { type: 'PAUSE_SIM_WORLD' }
  | { type: 'RESUME_SIM_WORLD' }
  | { type: 'START_ACTIVITY_OBSERVATION'; activityId: string }
  | { type: 'ACTIVITY_OBSERVATION_DIALOGUE_CLOSED'; activityId: string }
  | { type: 'ACTIVITY_OBSERVATION_SETTLED'; activityId: string }
  | { type: 'CANCEL_ACTIVITY_OBSERVATION'; activityId: string };

export type CharacterEvent =
  | {
    type: EventType.Tick;
    nearbyCharacterIds?: string[];
    nearbyRelationships?: readonly CharacterEventNearbyRelationship[];
    nearbyJoinableActivities?: readonly JoinableActivity[];
    nearbyVisibleItems?: readonly CharacterEventNearbyVisibleItem[];
    ownItemIds?: readonly string[];
    globalEventTags?: string[];
    timestamp?: number;
    allowAutonomousDecision?: boolean;
  }
  | { type: EventType.PassBy; targetCharId: string; timestamp?: number }
  | { type: EventType.GoEat; target: Position }
  | { type: EventType.GoHome }
  | { type: EventType.StartBehavior; behaviorId: string; target?: Position; timestamp?: number }
  | { type: EventType.EnterApartment; apartmentSpaceId: string }
  | { type: EventType.LeaveApartment; worldSpaceId: string; position: Position }
  | { type: EventType.StartActivity; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivity; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivityAccepted; activityId: string; sourceEventId: string }
  | { type: EventType.JoinActivityRejected; activityId: string }
  | {
    type: EventType.EndJoinedActivity;
    activityId: string;
    participantIds?: readonly string[];
    sourceEventId?: string;
    activityRole?: 'initiator' | 'target';
    activityEffects?: CharacterEventActivityEffects;
    outcomeId?: string;
    resolvedBy?: ActivityOutcomeResolvedBy;
    cancelled?: boolean;
    timestamp?: number;
  }
  | {
    type: EventType.RecordActivityCooldown;
    partnerCharIds: string[];
    role: 'initiator' | 'target';
    sourceEventId: string;
    timestamp?: number;
  }
  | {
    type: EventType.RememberRelationshipMemory;
    targetCharId: string;
    memoryType: MemoryType;
    countDelta: number;
    startedById: string;
    timestamp?: number;
  }
  | {
    type: EventType.RememberSpokenLine;
    targetCharId: string;
    memoryKey: string;
    text: string;
    timestamp?: number;
  }
  | {
    type: EventType.ApplyRequestEffects;
    requestEffects: readonly CharacterRequestSatisfiedEffect[];
  }
  | { type: EventType.NormalizeRomanceFeelings }
  | { type: EventType.SetControlState; controlState: CharacterControlState; reason: CharacterControlReason }
  | { type: EventType.GoIdle }
  | { type: EventType.PickUp }
  | { type: EventType.Drop; position?: Position }
  | { type: EventType.MoveTo; target: Position }
  | { type: EventType.Arrive; position: Position }
  | { type: EventType.MoveBlocked; position?: Position }
  | { type: EventType.ApplyOfflineRuntime; runtime: CharacterRuntimeInput }
  | { type: EventType.StartThinking }
  | { type: EventType.StopThinking }
  | { type: EventType.SetExpressionPreset; expressionPresetId: ExpressionPresetId }
  | { type: EventType.HoldItem; itemInstanceId: ItemInstanceId; definitionId: ItemDefinitionId }
  | { type: EventType.ReleaseHeldItem }
  | { type: EventType.AddLock; parts: ('bodyAction' | 'bodyMove' | 'mind' | 'communication')[]; reason: CharacterControlReason }
  | { type: EventType.RemoveLock; parts: ('bodyAction' | 'bodyMove' | 'mind' | 'communication')[]; reason: CharacterControlReason };

export type CharacterEventOld =
  | { type: EventType.Tick } // 自動：時間流逝
  | { type: EventType.SenseObject; objectId: string; gridType: string } // 自動：感應到物品
  | { type: EventType.SocialProximity; targetActorId: string } // 自動：感知到附近有人
  | { type: EventType.RequestAction; actionType: 'WANT_FRIEND' | 'HUNGRY'; payload: unknown } // 主動：需要玩家點擊
  | { type: EventType.UserClick; actionId: string } // 主動：玩家點擊核准


export enum EventType {
  Tick = "tick", // 自動：時間流逝
  SenseObject = "senseObject", // 自動：感應到物品
  SocialProximity = "socialProximity", // 自動：感知到附近有人
  RequestAction = "requestAction", // 主動：提出需求，需要玩家點擊
  UserClick = "userClick", // 主動：玩家點擊
  PassBy = "passBy", // 自動：擦肩而過
  GoEat = "goEat",
  GoHome = "goHome",
  StartBehavior = "startBehavior",
  EnterApartment = "enterApartment",
  LeaveApartment = "leaveApartment",
  StartActivity = "startActivity",
  JoinActivity = "joinActivity",
  JoinActivityAccepted = "joinActivityAccepted",
  JoinActivityRejected = "joinActivityRejected",
  EndJoinedActivity = "endJoinedActivity",
  RecordActivityCooldown = "recordActivityCooldown",
  RememberRelationshipMemory = "rememberRelationshipMemory",
  RememberSpokenLine = "rememberSpokenLine",
  ApplyRequestEffects = "applyRequestEffects",
  NormalizeRomanceFeelings = "normalizeRomanceFeelings",
  SetControlState = "setControlState",
  GoIdle = "goIdle",
  PickUp = "pickUp",
  Drop = "drop",
  MoveTo = "moveTo",
  Arrive = "arrive",
  MoveBlocked = "moveBlocked",
  ApplyOfflineRuntime = "applyOfflineRuntime",
  StartThinking = "startThinking",
  StopThinking = "stopThinking",
  SetExpressionPreset = "setExpressionPreset",
  HoldItem = "holdItem",
  ReleaseHeldItem = "releaseHeldItem",
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
    expressionPresetId?: ExpressionPresetId;
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
