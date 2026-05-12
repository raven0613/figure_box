import { SocialStatus, DirectedRelationship, Mood } from "./character";

export type EventTriggerType = 'auto' | 'click' | 'request';
export type EventValue = string | number | boolean | null;
export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'includes';
export type ClauseMode = 'all' | 'some';
export type ParticipantRole = 'initiator' | 'target';
export type CommandTarget = ParticipantRole | 'relationship' | 'blackboard';
export type ValuePath =
    | `initiator.${string}`
    | `target.${string}`
    | `blackboard.${string}`
    | `relationship.${string}`;

export enum TimeOfDay {
    Morning = "morning",
    Afternoon = "afternoon",
    Evening = "evening",
    Night = "night"
}

export enum Weather {
    Sunny = "sunny",
    Clear = "clear",
    Cloudy = "cloudy",
    Foggy = "foggy",
    Rainy = "rainy",
    Snowy = "snowy",
    Snowstorm = "snowstorm"
}

export interface EventBlackboard {
    locationId?: string;
    timeOfDay?: TimeOfDay;
    weather?: Weather;
    mutualStatus?: SocialStatus;
    relationship?: DirectedRelationship;
    recentScriptIds?: string[];
    values?: Record<string, unknown>;
    random?: () => number;
}

export interface RuleClause {
    path: ValuePath;
    operator: ComparisonOperator;
    value: EventValue | EventValue[];
}

export interface EventCondition {
    locationIds?: string[];
    timeOfDay?: EventBlackboard['timeOfDay'][];
    mutualStatuses?: SocialStatus[];
    minIntimacy?: number;
    maxIntimacy?: number;
    initiatorTraits?: string[];
    targetTraits?: string[];
    clauseMode?: ClauseMode;
    clauses?: RuleClause[];
}

export interface GameEvent {
    id: string;
    name: string;
    type: EventTriggerType;
    limitChar: number;
    baseWeight: number;
    condition: EventCondition;
    commands: Command[];
}

export type Command =
    | PlayDialogueCommand
    | ChangeStatCommand
    | PlayAnimCommand
    | SetBlackboardCommand;

export interface PlayDialogueCommand {
    type: 'PLAY_DIALOGUE';
    dialogueGroupId?: string;
    scriptId?: string;
}

export interface ChangeStatCommand {
    type: 'CHANGE_STAT';
    target: CommandTarget;
    statPath: string;
    operation: 'add' | 'set' | 'multiply';
    value: number;
}

export interface EventActor {
    id: string;
    name: string;
    traits?: string[];
    status?: {
        mood?: Mood;
        moodValue?: number;
        saturation?: number;
        stamina?: number;
    };
    attributes?: Record<string, EventValue>;
}

export interface PlayAnimCommand {
    type: 'PLAY_ANIM';
    target: ParticipantRole | 'both';
    animId?: string;
    emoji?: string;
    actionTag?: string;
    durationMs?: number;
}

export interface SetBlackboardCommand {
    type: 'SET_BLACKBOARD';
    scope: 'global' | 'local' | 'relationship';
    key: string;
    value: unknown;
    ttlMs?: number;
}
